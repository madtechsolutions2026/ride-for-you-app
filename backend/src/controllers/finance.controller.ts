import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

/**
 * GET /api/admin/finance/summary
 * Net P&L, Earnings vs. Expenses, Category breakdowns, and Monthly trends
 */
export async function getFinancialSummary(req: AuthRequest, res: Response) {
  try {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Total lifetime revenue from completed payments
    const totalRevenueAgg = await prisma.payment.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amount: true },
    });
    const totalRevenue = Number(totalRevenueAgg._sum.amount || 0);

    // Current month revenue
    const currentMonthRevenueAgg = await prisma.payment.aggregate({
      where: {
        status: 'SUCCESS',
        createdAt: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
      },
      _sum: { amount: true },
    });
    const currentMonthRevenue = Number(currentMonthRevenueAgg._sum.amount || 0);

    // Total lifetime expenses
    const totalExpensesAgg = await prisma.expense.aggregate({
      _sum: { amount: true },
    });
    const totalExpenses = Number(totalExpensesAgg._sum.amount || 0);

    // Current month expenses
    const currentMonthExpensesAgg = await prisma.expense.aggregate({
      where: {
        date: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
      },
      _sum: { amount: true },
    });
    const currentMonthExpenses = Number(currentMonthExpensesAgg._sum.amount || 0);

    // Category breakdown
    const expensesByCategoryRaw = await prisma.expense.groupBy({
      by: ['category'],
      _sum: { amount: true },
      _count: true,
    });

    const expensesByCategory = expensesByCategoryRaw.map((item) => ({
      category: item.category,
      amount: Number(item._sum.amount || 0),
      count: item._count,
    }));

    // Last 6 months trend calculation
    const monthlyTrends: Array<{
      month: string;
      year: number;
      revenue: number;
      expenses: number;
      profit: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthName = monthDate.toLocaleString('default', { month: 'short' });

      const [revAgg, expAgg] = await Promise.all([
        prisma.payment.aggregate({
          where: {
            status: 'SUCCESS',
            createdAt: { gte: monthStart, lte: monthEnd },
          },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: {
            date: { gte: monthStart, lte: monthEnd },
          },
          _sum: { amount: true },
        }),
      ]);

      const rev = Number(revAgg._sum.amount || 0);
      const exp = Number(expAgg._sum.amount || 0);

      monthlyTrends.push({
        month: monthName,
        year: monthDate.getFullYear(),
        revenue: rev,
        expenses: exp,
        profit: rev - exp,
      });
    }

    return res.json({
      success: true,
      data: {
        overview: {
          totalRevenue,
          totalExpenses,
          netProfit: totalRevenue - totalExpenses,
          currentMonthRevenue,
          currentMonthExpenses,
          currentMonthNetProfit: currentMonthRevenue - currentMonthExpenses,
        },
        expensesByCategory,
        monthlyTrends,
      },
    });
  } catch (error: any) {
    console.error('getFinancialSummary error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch financial summary' });
  }
}

/**
 * GET /api/admin/finance/expenses
 * List all expenses with filtering
 */
export async function listExpenses(req: AuthRequest, res: Response) {
  try {
    const { category, hubId, fromDate, toDate, page = '1', limit = '50' } = req.query;

    const where: any = {};
    if (category) where.category = category as any;
    if (hubId) where.hubId = hubId as string;
    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate as string);
      if (toDate) where.date.lte = new Date(toDate as string);
    }

    const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
    const take = parseInt(limit as string, 10);

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          hub: { select: { id: true, name: true, city: true } },
          addedByEmployee: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      prisma.expense.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        expenses,
        total,
        page: parseInt(page as string, 10),
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    console.error('listExpenses error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list expenses' });
  }
}

/**
 * POST /api/admin/finance/expenses
 * Create a new expense entry
 */
export async function createExpense(req: AuthRequest, res: Response) {
  try {
    const { category, amount, note, hubId, date, addedByEmployeeId } = req.body;

    if (!category || amount === undefined || !note) {
      return res.status(400).json({
        success: false,
        message: 'Category, amount, and note are required',
      });
    }

    const expense = await prisma.expense.create({
      data: {
        category,
        amount: Math.round(parseFloat(amount)),
        note,
        hubId: hubId || null,
        date: date ? new Date(date) : new Date(),
        addedByEmployeeId: addedByEmployeeId || null,
      },
      include: {
        hub: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({
      success: true,
      data: expense,
      message: 'Expense created successfully',
    });
  } catch (error: any) {
    console.error('createExpense error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create expense' });
  }
}

/**
 * DELETE /api/admin/finance/expenses/:id
 */
export async function deleteExpense(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    await prisma.expense.delete({ where: { id } });
    return res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error: any) {
    console.error('deleteExpense error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete expense' });
  }
}
