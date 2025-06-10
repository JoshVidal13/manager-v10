"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  PieChart,
  BarChart3,
  Target,
  Award,
  AlertTriangle,
  DollarSign,
} from "lucide-react"
import {
  format,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isWithinInterval,
  startOfYear,
  endOfYear,
} from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { useEntries } from "@/hooks/use-entries"
import { ConnectionStatus } from "@/components/connection-status"
import { createLocalDate } from "@/lib/date-utils"

interface WeeklyData {
  week: string
  weekStart: Date
  weekEnd: Date
  ingresos: number
  gastos: number
  balance: number
  entries: any[]
}

interface CategoryData {
  category: string
  amount: number
  percentage: number
  entries: any[]
  trend: "up" | "down" | "stable"
}

const CATEGORY_COLORS = {
  // Gastos
  Carne: "bg-red-100 text-red-800 border-red-200",
  Agua: "bg-blue-100 text-blue-800 border-blue-200",
  Gas: "bg-orange-100 text-orange-800 border-orange-200",
  Salarios: "bg-purple-100 text-purple-800 border-purple-200",
  Insumos: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Transporte: "bg-green-100 text-green-800 border-green-200",
  Servicios: "bg-indigo-100 text-indigo-800 border-indigo-200",
  Refresco: "bg-pink-100 text-pink-800 border-pink-200",
  Otros: "bg-gray-100 text-gray-800 border-gray-200",
  // Ingresos
  Efectivo: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Transferencia: "bg-teal-100 text-teal-800 border-teal-200",
  Ventas: "bg-cyan-100 text-cyan-800 border-cyan-200",
  Servicios: "bg-sky-100 text-sky-800 border-sky-200",
}

export default function ReportsPage() {
  const { entries, loading } = useEntries()
  const [selectedPeriod, setSelectedPeriod] = useState("thisMonth")
  const [currentDate, setCurrentDate] = useState(new Date())

  const filteredEntries = useMemo(() => {
    const now = new Date()
    let startDate: Date
    let endDate: Date

    switch (selectedPeriod) {
      case "thisWeek":
        startDate = startOfWeek(now, { weekStartsOn: 1 })
        endDate = endOfWeek(now, { weekStartsOn: 1 })
        break
      case "thisMonth":
        startDate = startOfMonth(currentDate)
        endDate = endOfMonth(currentDate)
        break
      case "thisYear":
        startDate = startOfYear(now)
        endDate = endOfYear(now)
        break
      default:
        return entries
    }

    return entries.filter((entry) => {
      const entryDate = createLocalDate(entry.date)
      return isWithinInterval(entryDate, { start: startDate, end: endDate })
    })
  }, [entries, selectedPeriod, currentDate])

  const weeklyData = useMemo(() => {
    if (selectedPeriod !== "thisMonth") return []

    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 })

    return weeks.map((weekStart) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
      const weekEntries = entries.filter((entry) => {
        const entryDate = createLocalDate(entry.date)
        return isWithinInterval(entryDate, { start: weekStart, end: weekEnd })
      })

      const ingresos = weekEntries.filter((e) => e.type === "ingreso").reduce((sum, e) => sum + e.amount, 0)
      const gastos = weekEntries.filter((e) => e.type === "gasto").reduce((sum, e) => sum + e.amount, 0)

      return {
        week: `Semana ${format(weekStart, "d")} - ${format(weekEnd, "d MMM")}`,
        weekStart,
        weekEnd,
        ingresos,
        gastos,
        balance: ingresos - gastos,
        entries: weekEntries,
      }
    })
  }, [entries, currentDate, selectedPeriod])

  const categoryAnalysis = useMemo(() => {
    const gastoCategories: { [key: string]: CategoryData } = {}
    const ingresoCategories: { [key: string]: CategoryData } = {}

    const gastoEntries = filteredEntries.filter((e) => e.type === "gasto")
    const ingresoEntries = filteredEntries.filter((e) => e.type === "ingreso")

    const totalGastos = gastoEntries.reduce((sum, e) => sum + e.amount, 0)
    const totalIngresos = ingresoEntries.reduce((sum, e) => sum + e.amount, 0)

    // Analizar gastos por categoría
    gastoEntries.forEach((entry) => {
      if (!gastoCategories[entry.category]) {
        gastoCategories[entry.category] = {
          category: entry.category,
          amount: 0,
          percentage: 0,
          entries: [],
          trend: "stable",
        }
      }
      gastoCategories[entry.category].amount += entry.amount
      gastoCategories[entry.category].entries.push(entry)
    })

    // Calcular porcentajes para gastos
    Object.values(gastoCategories).forEach((cat) => {
      cat.percentage = totalGastos > 0 ? (cat.amount / totalGastos) * 100 : 0
    })

    // Analizar ingresos por categoría
    ingresoEntries.forEach((entry) => {
      if (!ingresoCategories[entry.category]) {
        ingresoCategories[entry.category] = {
          category: entry.category,
          amount: 0,
          percentage: 0,
          entries: [],
          trend: "stable",
        }
      }
      ingresoCategories[entry.category].amount += entry.amount
      ingresoCategories[entry.category].entries.push(entry)
    })

    // Calcular porcentajes para ingresos
    Object.values(ingresoCategories).forEach((cat) => {
      cat.percentage = totalIngresos > 0 ? (cat.amount / totalIngresos) * 100 : 0
    })

    return {
      gastos: Object.values(gastoCategories).sort((a, b) => b.amount - a.amount),
      ingresos: Object.values(ingresoCategories).sort((a, b) => b.amount - a.amount),
    }
  }, [filteredEntries])

  const periodTotals = useMemo(() => {
    const ingresos = filteredEntries.filter((e) => e.type === "ingreso").reduce((sum, e) => sum + e.amount, 0)
    const gastos = filteredEntries.filter((e) => e.type === "gasto").reduce((sum, e) => sum + e.amount, 0)

    return {
      ingresos,
      gastos,
      balance: ingresos - gastos,
      entries: filteredEntries.length,
    }
  }, [filteredEntries])

  const insights = useMemo(() => {
    const insights = []

    if (categoryAnalysis.gastos.length > 0) {
      const topGasto = categoryAnalysis.gastos[0]
      if (topGasto.percentage > 40) {
        insights.push({
          type: "warning",
          title: "Concentración de gastos",
          message: `${topGasto.category} representa el ${topGasto.percentage.toFixed(1)}% de tus gastos`,
          icon: AlertTriangle,
        })
      }
    }

    if (periodTotals.balance > 0) {
      insights.push({
        type: "success",
        title: "¡Excelente gestión!",
        message: `Tienes un superávit de $${periodTotals.balance.toLocaleString()}`,
        icon: Award,
      })
    }

    const savingsRate = periodTotals.ingresos > 0 ? (periodTotals.balance / periodTotals.ingresos) * 100 : 0
    if (savingsRate > 20) {
      insights.push({
        type: "success",
        title: "Gran tasa de ahorro",
        message: `Estás ahorrando el ${savingsRate.toFixed(1)}% de tus ingresos`,
        icon: Target,
      })
    }

    return insights
  }, [categoryAnalysis, periodTotals])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
              <span>Cargando reportes...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-purple-600 hover:text-purple-800">
              <ArrowLeft className="w-4 h-4" />
              Volver al Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-800">Reportes Detallados</h1>
            <ConnectionStatus />
          </div>

          <div className="flex gap-2">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thisWeek">Esta Semana</SelectItem>
                <SelectItem value="thisMonth">Este Mes</SelectItem>
                <SelectItem value="thisYear">Este Año</SelectItem>
              </SelectContent>
            </Select>

            {selectedPeriod === "thisMonth" && (
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                  ←
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                  →
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Period Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-100 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Ingresos del Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">${periodTotals.ingresos.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-rose-100 border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Gastos del Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">${periodTotals.gastos.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card
            className={`bg-gradient-to-br ${periodTotals.balance >= 0 ? "from-blue-50 to-cyan-100 border-blue-200" : "from-orange-50 to-amber-100 border-orange-200"}`}
          >
            <CardHeader className="pb-2">
              <CardTitle
                className={`text-sm font-medium flex items-center gap-2 ${periodTotals.balance >= 0 ? "text-blue-800" : "text-orange-800"}`}
              >
                <DollarSign className="w-4 h-4" />
                Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${periodTotals.balance >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                ${periodTotals.balance.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-violet-100 border-purple-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Total Movimientos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">{periodTotals.entries}</div>
            </CardContent>
          </Card>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights.map((insight, index) => (
              <Card
                key={index}
                className={`${
                  insight.type === "success" ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
                }`}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <insight.icon
                      className={`w-5 h-5 mt-0.5 ${insight.type === "success" ? "text-green-600" : "text-yellow-600"}`}
                    />
                    <div>
                      <h3
                        className={`font-semibold ${insight.type === "success" ? "text-green-800" : "text-yellow-800"}`}
                      >
                        {insight.title}
                      </h3>
                      <p className={`text-sm ${insight.type === "success" ? "text-green-700" : "text-yellow-700"}`}>
                        {insight.message}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="categories" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <PieChart className="w-4 h-4" />
              Por Categorías
            </TabsTrigger>
            <TabsTrigger value="weekly" className="flex items-center gap-2" disabled={selectedPeriod !== "thisMonth"}>
              <Calendar className="w-4 h-4" />
              Por Semanas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gastos por Categoría */}
              <Card className="bg-gradient-to-br from-red-50 to-pink-50">
                <CardHeader>
                  <CardTitle className="text-red-800 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5" />
                    Gastos por Categoría
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {categoryAnalysis.gastos.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay gastos en este período</p>
                  ) : (
                    categoryAnalysis.gastos.map((category, index) => (
                      <div key={category.category} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={`${CATEGORY_COLORS[category.category as keyof typeof CATEGORY_COLORS] || "bg-gray-100 text-gray-800"} text-xs`}
                            >
                              #{index + 1}
                            </Badge>
                            <span className="font-medium">{category.category}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-red-600">${category.amount.toLocaleString()}</div>
                            <div className="text-xs text-gray-500">{category.percentage.toFixed(1)}%</div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Progress value={category.percentage} className="h-2" />
                          <div className="text-xs text-gray-600">
                            {category.entries.length} movimiento{category.entries.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Ingresos por Categoría */}
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50">
                <CardHeader>
                  <CardTitle className="text-green-800 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Ingresos por Categoría
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {categoryAnalysis.ingresos.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay ingresos en este período</p>
                  ) : (
                    categoryAnalysis.ingresos.map((category, index) => (
                      <div key={category.category} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={`${CATEGORY_COLORS[category.category as keyof typeof CATEGORY_COLORS] || "bg-gray-100 text-gray-800"} text-xs`}
                            >
                              #{index + 1}
                            </Badge>
                            <span className="font-medium">{category.category}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-600">${category.amount.toLocaleString()}</div>
                            <div className="text-xs text-gray-500">{category.percentage.toFixed(1)}%</div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Progress value={category.percentage} className="h-2" />
                          <div className="text-xs text-gray-600">
                            {category.entries.length} movimiento{category.entries.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="weekly" className="space-y-6">
            {selectedPeriod === "thisMonth" && (
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-800">
                    {format(currentDate, "MMMM yyyy", { locale: es })}
                  </h2>
                  <p className="text-gray-600">Análisis semanal detallado</p>
                </div>

                <div className="grid gap-4">
                  {weeklyData.map((week, index) => (
                    <Card key={index} className="bg-gradient-to-r from-blue-50 to-purple-50">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="text-lg">{week.week}</span>
                          <Badge variant={week.balance >= 0 ? "default" : "destructive"} className="text-sm">
                            {week.balance >= 0 ? "Superávit" : "Déficit"}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">${week.ingresos.toLocaleString()}</div>
                            <div className="text-sm text-gray-600">Ingresos</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">${week.gastos.toLocaleString()}</div>
                            <div className="text-sm text-gray-600">Gastos</div>
                          </div>
                          <div className="text-center">
                            <div
                              className={`text-2xl font-bold ${week.balance >= 0 ? "text-blue-600" : "text-orange-600"}`}
                            >
                              ${week.balance.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-600">Balance</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">{week.entries.length}</div>
                            <div className="text-sm text-gray-600">Movimientos</div>
                          </div>
                        </div>

                        {week.entries.length > 0 && (
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            <h4 className="font-semibold text-gray-700 text-sm">Movimientos de la semana:</h4>
                            {week.entries.map((entry) => (
                              <div
                                key={entry.id}
                                className="flex items-center justify-between text-sm bg-white p-2 rounded border"
                              >
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={entry.type === "ingreso" ? "default" : "destructive"}
                                    className="text-xs"
                                  >
                                    {entry.category}
                                  </Badge>
                                  <span className="text-gray-600">{format(new Date(entry.date), "dd/MM")}</span>
                                </div>
                                <span
                                  className={`font-medium ${entry.type === "ingreso" ? "text-green-600" : "text-red-600"}`}
                                >
                                  ${entry.amount.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
