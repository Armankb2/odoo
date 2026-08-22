import { prisma } from '../lib/prisma';
import { notFound, validation } from '../lib/errors';
import type { ComponentBasis, ComputationType } from '@prisma/client';

/**
 * Salary component engine.
 *
 * The core is a pure function so it can be reasoned about and tested without a
 * database or an HTTP request — it is the most rule-dense part of the system
 * and the hardest thing to eyeball.
 *
 * Amounts are never persisted. They are recomputed from `monthlyWage` on every
 * read, which is exactly what the requirement "salary component values should
 * auto-update when the wage amount changes" demands.
 *
 * Two documented defects in the wireframe, both resolved in favour of the
 * stated RULES over the drawn sample figures:
 *
 *  1. Its sample components total ₹48,750 against a ₹50,000 wage. The stated
 *     rule is `Fixed Allowance = wage − total of all components`, which gives
 *     ₹4,168 — not the ₹2,918 drawn.
 *  2. Its annotation says "Percentage of Wage", but the drawn table plainly
 *     uses percentages OF BASIC for everything except Basic itself. The
 *     `basis` column on each component encodes which, so both are expressible.
 */

/** Round to paise. Money must never carry binary-float dust into a total. */
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface ComponentRule {
  id?: number;
  name: string;
  computationType: ComputationType;
  basis: ComponentBasis | null;
  value: number;
  sortOrder: number;
}

export interface StatutoryConfig {
  pfRateEmployee: number;
  pfRateEmployer: number;
  professionalTax: number;
}

export interface ComputedComponent {
  id?: number;
  name: string;
  computationType: ComputationType;
  basis: ComponentBasis | null;
  value: number;
  amount: number;
  /** Percentage of the wage this amount represents — what the UI column shows. */
  percentOfWage: number;
}

export interface SalaryBreakdown {
  monthlyWage: number;
  yearlyWage: number;
  components: ComputedComponent[];
  componentTotal: number;
  pf: { employee: number; employer: number; rateEmployee: number; rateEmployer: number };
  deductions: { pfEmployee: number; professionalTax: number; total: number };
  netMonthly: number;
  /** Non-fatal warnings — surfaced rather than thrown so the UI can still render. */
  warnings: string[];
}

export function computeSalary(
  monthlyWage: number,
  rules: ComponentRule[],
  config: StatutoryConfig,
): SalaryBreakdown {
  const wage = r2(monthlyWage);
  const ordered = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);
  const warnings: string[] = [];

  // Basic must resolve first: every other percentage component is expressed
  // relative to it.
  const basicRule = ordered.find((c) => c.basis === 'WAGE' && c.computationType === 'PERCENT');
  const basic = basicRule ? r2((wage * basicRule.value) / 100) : 0;
  if (!basicRule) warnings.push('No Basic component is defined as a percentage of wage');

  const computed: ComputedComponent[] = [];
  let runningTotal = 0;

  for (const rule of ordered) {
    let amount = 0;
    if (rule.computationType === 'PERCENT') {
      const base = rule.basis === 'WAGE' ? wage : basic;
      amount = r2((base * rule.value) / 100);
    } else if (rule.computationType === 'FIXED') {
      amount = r2(rule.value);
    } else {
      // REMAINDER is resolved after the loop — it depends on everything else.
      computed.push({ ...rule, amount: 0, percentOfWage: 0 });
      continue;
    }
    runningTotal = r2(runningTotal + amount);
    computed.push({
      ...rule,
      amount,
      percentOfWage: wage ? r2((amount / wage) * 100) : 0,
    });
  }

  // `Fixed Allowance = wage − total of all the component`. This is what makes
  // "the total of all components should not exceed the defined Wage" true by
  // construction rather than by validation.
  const remainderIdx = computed.findIndex((c) => c.computationType === 'REMAINDER');
  if (remainderIdx >= 0) {
    const remainder = r2(wage - runningTotal);
    if (remainder < 0) {
      warnings.push(
        `Components exceed the wage by ${Math.abs(remainder).toFixed(2)}; the remainder component would be negative`,
      );
    }
    computed[remainderIdx].amount = remainder;
    computed[remainderIdx].percentOfWage = wage ? r2((remainder / wage) * 100) : 0;
    runningTotal = r2(runningTotal + remainder);
  } else if (runningTotal > wage) {
    warnings.push(`Components total ${runningTotal.toFixed(2)}, which exceeds the wage`);
  }

  // "PF is calculated based on the basic salary" — both sides, rate configurable.
  const pfEmployee = r2((basic * config.pfRateEmployee) / 100);
  const pfEmployer = r2((basic * config.pfRateEmployer) / 100);
  const professionalTax = r2(config.professionalTax);
  const deductionTotal = r2(pfEmployee + professionalTax);

  return {
    monthlyWage: wage,
    // Derived, never stored — storing both invites them to disagree.
    yearlyWage: r2(wage * 12),
    components: computed,
    componentTotal: runningTotal,
    pf: {
      employee: pfEmployee,
      employer: pfEmployer,
      rateEmployee: config.pfRateEmployee,
      rateEmployer: config.pfRateEmployer,
    },
    deductions: { pfEmployee, professionalTax, total: deductionTotal },
    netMonthly: r2(runningTotal - deductionTotal),
    warnings,
  };
}

// ------------------------------------------------------------ persistence

async function loadStructure(userId: number) {
  const structure = await prisma.salaryStructure.findUnique({
    where: { userId },
    include: { components: true, user: { select: { companyId: true } } },
  });
  if (!structure) throw notFound('No salary structure exists for this employee');

  const company = await prisma.company.findUnique({
    where: { id: structure.user.companyId },
    select: { pfRateEmployee: true, pfRateEmployer: true, professionalTax: true },
  });
  if (!company) throw notFound('Company not found');

  return { structure, company };
}

/** Full computed breakdown for one employee. */
export async function salaryFor(userId: number) {
  const { structure, company } = await loadStructure(userId);

  const breakdown = computeSalary(
    Number(structure.monthlyWage),
    structure.components.map((c) => ({
      id: c.id,
      name: c.name,
      computationType: c.computationType,
      basis: c.basis,
      value: Number(c.value),
      sortOrder: c.sortOrder,
    })),
    {
      pfRateEmployee: Number(company.pfRateEmployee),
      pfRateEmployer: Number(company.pfRateEmployer),
      professionalTax: Number(company.professionalTax),
    },
  );

  return {
    structureId: structure.id,
    workingDaysPerWeek: structure.workingDaysPerWeek,
    breakMinutes: structure.breakMinutes,
    effectiveFrom: structure.effectiveFrom,
    ...breakdown,
  };
}

/**
 * Preview a wage change without saving.
 *
 * The UI needs live recalculation as the wage field changes. Doing that here
 * rather than reimplementing the formula in React keeps one implementation —
 * the numbers on screen are the numbers that will be saved.
 */
export async function previewSalary(userId: number, monthlyWage: number) {
  if (!(monthlyWage >= 0)) throw validation('Wage must be a positive number');
  const { structure, company } = await loadStructure(userId);

  return computeSalary(
    monthlyWage,
    structure.components.map((c) => ({
      name: c.name,
      computationType: c.computationType,
      basis: c.basis,
      value: Number(c.value),
      sortOrder: c.sortOrder,
    })),
    {
      pfRateEmployee: Number(company.pfRateEmployee),
      pfRateEmployer: Number(company.pfRateEmployer),
      professionalTax: Number(company.professionalTax),
    },
  );
}

/** Admin-only. Employees can view their salary but never change it. */
export async function updateSalary(
  companyId: number,
  userId: number,
  input: {
    monthlyWage?: number;
    workingDaysPerWeek?: number;
    breakMinutes?: number;
    components?: ComponentRule[];
  },
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: { id: true },
  });
  if (!user) throw notFound('Employee not found');

  const existing = await prisma.salaryStructure.findUnique({ where: { userId } });
  if (!existing) throw notFound('No salary structure exists for this employee');

  if (input.monthlyWage !== undefined && input.monthlyWage < 0) {
    throw validation('Wage cannot be negative');
  }

  await prisma.$transaction(async (tx) => {
    await tx.salaryStructure.update({
      where: { userId },
      data: {
        monthlyWage: input.monthlyWage,
        workingDaysPerWeek: input.workingDaysPerWeek,
        breakMinutes: input.breakMinutes,
      },
    });

    // Components are replaced wholesale — a partial merge would leave orphaned
    // rules whose names no longer match anything the admin can see.
    if (input.components) {
      await tx.salaryComponent.deleteMany({ where: { salaryStructureId: existing.id } });
      await tx.salaryComponent.createMany({
        data: input.components.map((c) => ({
          salaryStructureId: existing.id,
          name: c.name,
          computationType: c.computationType,
          basis: c.basis,
          value: c.value,
          sortOrder: c.sortOrder,
        })),
      });
    }
  });

  return salaryFor(userId);
}
