"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Trash2,
  Download,
  BarChart3,
  Plus,
  AlertCircle,
  PieChart,
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { useEntries } from "@/hooks/use-entries"
import { ConnectionStatus } from "@/components/connection-status"
import { RealtimeStatus } from "@/components/realtime-status"
import type { Entry } from "@/lib/supabase"
import { EditEntryDialog } from "@/components/edit-entry-dialog"
import { DateDisplay } from "@/components/date-display"
import { ThemeToggle } from "@/components/theme-toggle"
import { startOfWeek, endOfWeek, eachWeekOfInterval, isWithinInterval } from "date-fns"
import { formatDateForStorage, getCurrentDateString, createLocalDate } from "@/lib/date-utils"
import { FinanceChart } from "@/components/finance-chart"

interface CategoryTotals {
  [key: string]: number
}

const CATEGORIES = {
  gasto: ["Carne", "Agua", "Gas", "Salarios", "Insumos", "Transporte", "Servicios", "Refresco", "Otros", "Cambio"],
  ingreso: ["Efectivo", "Transferencia", "Ventas", "Servicios", "Otros", "Cambio"],
}

export default function ExpenseIncomeManager() {
  const { entries, loading, error, addEntry, deleteEntry, updateEntry, refetch } = useEntries()
  const [newEntry, setNewEntry] = useState({
    type: "gasto" as "gasto" | "ingreso",
    category: "",
    amount: "",
    date: getCurrentDateString(),
    description: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddEntry = async () => {
    if (!newEntry.category || !newEntry.amount || isSubmitting) return

    setIsSubmitting(true)
    try {
      const entryData: Omit<Entry, "id" | "created_at" | "updated_at"> = {
        type: newEntry.type,
        category: newEntry.category,
        amount: Number.parseFloat(newEntry.amount),
        date: formatDateForStorage(newEntry.date),
        description: newEntry.description || undefined,
      }

      const result = await addEntry(entryData)
      if (result) {
        setNewEntry({
          type: "gasto",
          category: "",
          amount: "",
          date: getCurrentDateString(),
          description: "",
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteEntry = async (id: string) => {
    if (!id) return
    await deleteEntry(id)
  }

  const exportData = () => {
    const dataStr = JSON.stringify(entries, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `gastos-ingresos-${format(new Date(), "yyyy-MM-dd")}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Calculate totals
  const totals = useMemo(() => {
    const gastos = entries.filter((e) => e.type === "gasto").reduce((sum, e) => sum + e.amount, 0)
    const ingresos = entries.filter((e) => e.type === "ingreso").reduce((sum, e) => sum + e.amount, 0)
    // El balance ahora es solo los ingresos, sin restar los gastos
    return { gastos, ingresos, balance: ingresos }
  }, [entries])

  // Calculate category totals
  const categoryTotals = useMemo(() => {
    const gastoTotals: CategoryTotals = {}
    const ingresoTotals: CategoryTotals = {}

    entries.forEach((entry) => {
      if (entry.type === "gasto") {
        gastoTotals[entry.category] = (gastoTotals[entry.category] || 0) + entry.amount
      } else {
        ingresoTotals[entry.category] = (ingresoTotals[entry.category] || 0) + entry.amount
      }
    })

    return { gastos: gastoTotals, ingresos: ingresoTotals }
  }, [entries])

  // Group entries by week
  const entriesByWeek = useMemo(() => {
    if (entries.length === 0) return []

    // Get the date range of all entries
    const dates = entries.map((entry) => createLocalDate(entry.date))
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

    // Get all weeks in the range
    const weeks = eachWeekOfInterval(
      { start: startOfWeek(minDate, { weekStartsOn: 1 }), end: endOfWeek(maxDate, { weekStartsOn: 1 }) },
      { weekStartsOn: 1 },
    )

    return weeks
      .map((weekStart) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
        const weekEntries = entries.filter((entry) => {
          const entryDate = createLocalDate(entry.date)
          return isWithinInterval(entryDate, { start: weekStart, end: weekEnd })
        })

        const weekIngresos = weekEntries.filter((e) => e.type === "ingreso").reduce((sum, e) => sum + e.amount, 0)
        const weekGastos = weekEntries.filter((e) => e.type === "gasto").reduce((sum, e) => sum + e.amount, 0)

        return {
          weekStart,
          weekEnd,
          entries: weekEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          ingresos: weekIngresos,
          gastos: weekGastos,
          // El balance semanal también es solo los ingresos
          balance: weekIngresos,
        }
      })
      .filter((week) => week.entries.length > 0)
      .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
  }, [entries])

  // Datos para gráficos
  const chartData = useMemo(() => {
    // Datos para gráfico de categorías de gastos
    const gastosCategorias = Object.entries(categoryTotals.gastos).map(([category, amount]) => ({
      name: category,
      value: amount,
    }))

    // Datos para gráfico de categorías de ingresos
    const ingresosCategorias = Object.entries(categoryTotals.ingresos).map(([category, amount]) => ({
      name: category,
      value: amount,
    }))

    // Datos para gráfico de tendencia semanal
    const semanasData = entriesByWeek
      .slice(0, 8)
      .reverse()
      .map((week) => ({
        name: format(week.weekStart, "dd/MM"),
        ingresos: week.ingresos,
        gastos: week.gastos,
      }))

    return {
      gastosCategorias,
      ingresosCategorias,
      semanasData,
    }
  }, [categoryTotals, entriesByWeek])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-400"></div>
              <span>Cargando datos...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-4 mb-2">
            <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">Gestión de Gastos e Ingresos</h1>
            <div className="flex flex-col gap-1">
              <ConnectionStatus />
              <RealtimeStatus />
            </div>
            <ThemeToggle />
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            Controla tus finanzas de manera eficiente - Sincronizado en tiempo real
          </p>

          {error && (
            <Alert variant="destructive" className="max-w-md mx-auto">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-center gap-4">
            <Link
              href="/calendar/"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Ver Calendario
            </Link>
            <Link
              href="/reports/"
              className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 font-medium flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              Reportes Detallados
            </Link>
            <Button onClick={exportData} variant="outline" size="sm" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exportar Datos
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800 dark:text-green-300">Ingresos Totales</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                ${totals.ingresos.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-800 dark:text-red-300">Gastos Totales</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">${totals.gastos.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-300">Balance (Ingresos)</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                ${totals.balance.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="dark:bg-gray-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Distribución de Gastos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <FinanceChart
                  type="pie"
                  data={chartData.gastosCategorias}
                  colors={[
                    "#ef4444",
                    "#f97316",
                    "#f59e0b",
                    "#eab308",
                    "#84cc16",
                    "#22c55e",
                    "#14b8a6",
                    "#06b6d4",
                    "#0ea5e9",
                    "#6366f1",
                  ]}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Distribución de Ingresos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <FinanceChart
                  type="pie"
                  data={chartData.ingresosCategorias}
                  colors={["#22c55e", "#16a34a", "#15803d", "#166534", "#14532d", "#84cc16"]}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 dark:bg-gray-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Tendencia Semanal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <FinanceChart
                  type="bar"
                  data={chartData.semanasData}
                  keys={["ingresos", "gastos"]}
                  colors={["#22c55e", "#ef4444"]}
                  indexBy="name"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add New Entry Form */}
        <Card className="dark:bg-gray-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Agregar Nueva Entrada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={newEntry.type}
                  onValueChange={(value: "gasto" | "ingreso") =>
                    setNewEntry({ ...newEntry, type: value, category: "" })
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gasto">Gasto</SelectItem>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select
                  value={newEntry.category}
                  onValueChange={(value) => setNewEntry({ ...newEntry, category: value })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES[newEntry.type].map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Monto</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={newEntry.amount}
                  onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  value={newEntry.date}
                  onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  placeholder="Opcional"
                  value={newEntry.description}
                  onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <Button onClick={handleAddEntry} className="w-full md:w-auto" disabled={isSubmitting}>
              {isSubmitting ? "Agregando..." : "Agregar Entrada"}
            </Button>
          </CardContent>
        </Card>

        {/* Tabs for different views */}
        <Tabs defaultValue="entries" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="entries">Entradas Recientes</TabsTrigger>
            <TabsTrigger value="categories">Por Categorías</TabsTrigger>
            <TabsTrigger value="analytics">Análisis</TabsTrigger>
          </TabsList>

          <TabsContent value="entries" className="space-y-4">
            <Card className="dark:bg-gray-800/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Entradas por Semana ({entries.length} total)</CardTitle>
                  <Button onClick={() => refetch()} variant="outline" size="sm" disabled={loading}>
                    {loading ? "Cargando..." : "🔄"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6 max-h-[600px] overflow-y-auto">
                  {entriesByWeek.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">No hay entradas registradas</p>
                  ) : (
                    entriesByWeek.map((week, weekIndex) => (
                      <div key={weekIndex} className="space-y-3">
                        {/* Week Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div>
                            <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                              {format(week.weekStart, "d MMM", { locale: es })} -{" "}
                              {format(week.weekEnd, "d MMM yyyy", { locale: es })}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {week.entries.length} movimiento{week.entries.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm mt-2 md:mt-0">
                            <div className="text-center">
                              <div className="text-green-600 dark:text-green-400 font-bold">
                                +${week.ingresos.toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">Ingresos</div>
                            </div>
                            <div className="text-center">
                              <div className="text-red-600 dark:text-red-400 font-bold">
                                -${week.gastos.toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">Gastos</div>
                            </div>
                            <div className="text-center">
                              <div className="font-bold text-blue-600 dark:text-blue-400">
                                ${week.balance.toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">Balance</div>
                            </div>
                          </div>
                        </div>

                        {/* Week Entries */}
                        <div className="space-y-2 pl-0 md:pl-4">
                          {week.entries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex flex-col md:flex-row md:items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                            >
                              <DateDisplay date={entry.date} />

                              <div className="flex items-center gap-3 flex-1">
                                <Badge variant={entry.type === "ingreso" ? "default" : "destructive"}>
                                  {entry.type === "ingreso" ? "Ingreso" : "Gasto"}
                                </Badge>
                                <div className="flex-1">
                                  <p className="font-medium text-gray-800 dark:text-gray-100">{entry.category}</p>
                                  {entry.description && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{entry.description}</p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-2 mt-2 md:mt-0">
                                <span
                                  className={`font-bold text-lg ${entry.type === "ingreso" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                                >
                                  ${entry.amount.toLocaleString()}
                                </span>
                                <div className="flex gap-1">
                                  <EditEntryDialog entry={entry} onUpdate={updateEntry} />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => entry.id && handleDeleteEntry(entry.id)}
                                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="dark:bg-gray-800/50">
                <CardHeader>
                  <CardTitle className="text-red-700 dark:text-red-400">Gastos por Categoría</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(categoryTotals.gastos).length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No hay gastos registrados</p>
                  ) : (
                    Object.entries(categoryTotals.gastos).map(([category, amount]) => (
                      <div key={category} className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">{category}</span>
                          <span className="text-sm font-bold text-red-600 dark:text-red-400">
                            ${amount.toLocaleString()}
                          </span>
                        </div>
                        <Progress value={totals.gastos > 0 ? (amount / totals.gastos) * 100 : 0} className="h-2" />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="dark:bg-gray-800/50">
                <CardHeader>
                  <CardTitle className="text-green-700 dark:text-green-400">Ingresos por Categoría</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(categoryTotals.ingresos).length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No hay ingresos registrados</p>
                  ) : (
                    Object.entries(categoryTotals.ingresos).map(([category, amount]) => (
                      <div key={category} className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">{category}</span>
                          <span className="text-sm font-bold text-green-600 dark:text-green-400">
                            ${amount.toLocaleString()}
                          </span>
                        </div>
                        <Progress value={totals.ingresos > 0 ? (amount / totals.ingresos) * 100 : 0} className="h-2" />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card className="dark:bg-gray-800/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Análisis Financiero
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold">Resumen del Período</h3>
                    <div className="space-y-1 text-sm">
                      <p>
                        Total de entradas: <span className="font-medium">{entries.length}</span>
                      </p>
                      <p>
                        Promedio de gastos:{" "}
                        <span className="font-medium">
                          $
                          {entries.filter((e) => e.type === "gasto").length > 0
                            ? (totals.gastos / entries.filter((e) => e.type === "gasto").length).toLocaleString()
                            : 0}
                        </span>
                      </p>
                      <p>
                        Promedio de ingresos:{" "}
                        <span className="font-medium">
                          $
                          {entries.filter((e) => e.type === "ingreso").length > 0
                            ? (totals.ingresos / entries.filter((e) => e.type === "ingreso").length).toLocaleString()
                            : 0}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold">Estado Financiero</h3>
                    <div className="space-y-1 text-sm">
                      <p>
                        Porcentaje de gastos:{" "}
                        <span className="font-medium">
                          {totals.ingresos > 0 ? ((totals.gastos / totals.ingresos) * 100).toFixed(1) : 0}%
                        </span>
                      </p>
                      <p>
                        Categoría de gasto principal:{" "}
                        <span className="font-medium">
                          {Object.entries(categoryTotals.gastos).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"}
                        </span>
                      </p>
                      <p>
                        Categoría de ingreso principal:{" "}
                        <span className="font-medium">
                          {Object.entries(categoryTotals.ingresos).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
