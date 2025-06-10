"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react"
import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
} from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { useEntries } from "@/hooks/use-entries"
import { ConnectionStatus } from "@/components/connection-status"
import { createLocalDate, formatDateForStorage } from "@/lib/date-utils"
import { ThemeToggle } from "@/components/theme-toggle"

export default function CalendarPage() {
  const { entries, loading } = useEntries()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const dailyTotals = useMemo(() => {
    const totalsByDate: { [date: string]: { ingresos: number; gastos: number; entries: any[] } } = {}

    entries.forEach((entry) => {
      const dateStr = formatDateForStorage(entry.date)
      if (!totalsByDate[dateStr]) {
        totalsByDate[dateStr] = { ingresos: 0, gastos: 0, entries: [] }
      }
      totalsByDate[dateStr].entries.push(entry)
      if (entry.type === "ingreso") {
        totalsByDate[dateStr].ingresos += entry.amount
      } else {
        totalsByDate[dateStr].gastos += entry.amount
      }
    })

    return totalsByDate
  }, [entries])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentDate])

  const selectedDayEntries = useMemo(() => {
    if (!selectedDay) return []
    const dateStr = formatDateForStorage(selectedDay)
    return dailyTotals[dateStr]?.entries || []
  }, [selectedDay, dailyTotals])

  const monthlyTotals = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)

    let ingresos = 0
    let gastos = 0

    Object.entries(dailyTotals).forEach(([dateStr, totals]) => {
      const date = createLocalDate(dateStr)
      if (date >= monthStart && date <= monthEnd) {
        ingresos += totals.ingresos
        gastos += totals.gastos
      }
    })

    // El balance ahora es solo los ingresos, sin restar los gastos
    return { ingresos, gastos, balance: ingresos }
  }, [currentDate, dailyTotals])

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => (direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)))
    setSelectedDay(null)
  }

  const getDayColor = (day: Date) => {
    const dateStr = formatDateForStorage(day)
    const dayData = dailyTotals[dateStr]

    if (!dayData) return "bg-white dark:bg-gray-800"

    // Ahora el balance es solo los ingresos
    const balance = dayData.ingresos
    if (balance > 0) return "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
    return "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800"
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-400"></div>
              <span>Cargando calendario...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Calendario Financiero</h1>
            <ConnectionStatus />
          </div>
          <ThemeToggle />
        </div>

        {/* Monthly Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-300">Mes Actual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                {format(currentDate, "MMMM yyyy", { locale: es })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-800 dark:text-green-300">Ingresos del Mes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-green-700 dark:text-green-400">
                ${monthlyTotals.ingresos.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-800 dark:text-red-300">Gastos del Mes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-red-700 dark:text-red-400">
                ${monthlyTotals.gastos.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-300">Balance (Ingresos)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                ${monthlyTotals.balance.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card className="dark:bg-gray-800/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{format(currentDate, "MMMM yyyy", { locale: es })}</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigateMonth("prev")}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigateMonth("next")}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 mb-4">
                  {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day) => {
                    const dateStr = formatDateForStorage(day)
                    const dayData = dailyTotals[dateStr]
                    const isCurrentMonth = isSameMonth(day, currentDate)
                    const isSelected = selectedDay && isSameDay(day, selectedDay)

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDay(day)}
                        className={`
                          p-2 min-h-[80px] border rounded-lg text-left transition-all hover:shadow-md
                          ${getDayColor(day)}
                          ${!isCurrentMonth ? "opacity-40" : ""}
                          ${isSelected ? "ring-2 ring-blue-500" : ""}
                        `}
                      >
                        <div className="text-sm font-medium mb-1">{format(day, "d")}</div>
                        {dayData && (
                          <div className="space-y-1">
                            {dayData.ingresos > 0 && (
                              <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                                +${dayData.ingresos.toLocaleString()}
                              </div>
                            )}
                            {dayData.gastos > 0 && (
                              <div className="text-xs text-red-600 dark:text-red-400 font-medium">
                                -${dayData.gastos.toLocaleString()}
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Day Details */}
          <div>
            <Card className="dark:bg-gray-800/50">
              <CardHeader>
                <CardTitle>
                  {selectedDay
                    ? `Detalles del ${format(selectedDay, "d 'de' MMMM", { locale: es })}`
                    : "Selecciona un día"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDay ? (
                  <div className="space-y-4">
                    {selectedDayEntries.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-4">No hay movimientos este día</p>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {selectedDayEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border dark:border-gray-600"
                            >
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={entry.type === "ingreso" ? "default" : "destructive"}
                                  className="text-xs"
                                >
                                  {entry.type === "ingreso" ? "+" : "-"}
                                </Badge>
                                <div>
                                  <p className="text-sm font-medium">{entry.category}</p>
                                  {entry.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{entry.description}</p>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`text-sm font-bold ${entry.type === "ingreso" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                              >
                                ${entry.amount.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="border-t pt-3 dark:border-gray-600">
                          <div className="flex justify-between text-sm">
                            <span>Balance del día:</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              ${(dailyTotals[format(selectedDay, "yyyy-MM-dd")]?.ingresos || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    Haz clic en cualquier día del calendario para ver sus detalles
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
