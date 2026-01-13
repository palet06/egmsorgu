"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Play, Pause, Square, Upload } from "lucide-react"
import { queryEGMAPI } from "./actions"

interface QueryItem {
  egmCountryCode: string
  passportNo: string
}

interface APIResponse {
  success: boolean
  message: string
  data?: {
    turkiyedeMi: boolean
    kesinKarar: boolean
    ulkeyeSonGirisTarihi: string
    ulkedenSonCikisTarihi: string
    girisTarihleriList: string[]
    cikisTarihleriList: string[]
  }
  errorDetails: string | null
}

interface QueryResult extends QueryItem {
  status: "success" | "failed"
  apiResponse?: APIResponse
}

interface RequestLog {
  timestamp: string
  passportNo: string
  status: "success" | "failed"
  message: string
}

const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) return ""

  try {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const year = date.getFullYear()
    return `${day}.${month}.${year}`
  } catch {
    return dateString
  }
}

export default function EGMQuerySystem() {
  const [identityNumbers, setIdentityNumbers] = useState("")
  const [delayMs, setDelayMs] = useState(300)
  const [batchSize, setBatchSize] = useState(1)
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [totalQueries, setTotalQueries] = useState(0)
  const [completedQueries, setCompletedQueries] = useState(0)
  const [failedQueries, setFailedQueries] = useState(0)
  const [results, setResults] = useState<QueryResult[]>([])
  const [logs, setLogs] = useState<RequestLog[]>([])

  const stopRequestedRef = useRef(false)
  const pausedRef = useRef(false)

  const parseIdentityNumbers = (text: string): QueryItem[] => {
    try {
      let trimmedText = text.trim()

      // Replace "pasaportNo" with "passportNo" for API compatibility
      trimmedText = trimmedText.replace(/pasaportNo/g, "passportNo")

      // Replace ... (three dots) with comma
      trimmedText = trimmedText.replace(/\.\.\./g, ",")

      // Replace multiple newlines with single comma
      trimmedText = trimmedText.replace(/\n+/g, ",")

      // Replace multiple consecutive commas with single comma
      trimmedText = trimmedText.replace(/,+/g, ",")

      // Remove leading and trailing commas
      trimmedText = trimmedText.replace(/^,+|,+$/g, "")

      // Remove any whitespace between JSON objects
      trimmedText = trimmedText.replace(/}\s*{/g, "},{")

      // If text doesn't start with '[', wrap it in brackets to make it a valid JSON array
      if (!trimmedText.startsWith("[")) {
        trimmedText = `[${trimmedText}]`
      }

      const parsed = JSON.parse(trimmedText)
      if (Array.isArray(parsed)) {
        return parsed
      }
      return [parsed]
    } catch (error: any) {
      console.error("JSON Parse Error:", error.message)
      alert(`Hata: Geçersiz JSON formatı.\n\nDetay: ${error.message}\n\nLütfen formatı kontrol edin.`)
      return []
    }
  }

  const addLog = (passportNo: string, status: "success" | "failed", message: string) => {
    const log: RequestLog = {
      timestamp: new Date().toLocaleTimeString("tr-TR"),
      passportNo,
      status,
      message,
    }
    setLogs((prev) => [log, ...prev].slice(0, 100))
  }

  const queryAPI = async (item: QueryItem): Promise<QueryResult> => {
    try {
      const result = await queryEGMAPI(item)

      if (result.status === "success") {
        addLog(item.passportNo, "success", "Sorgu başarılı")
      } else {
        const errorMsg = result.apiResponse?.errorDetails || result.apiResponse?.message || "Bilinmeyen hata"
        addLog(item.passportNo, "failed", errorMsg)
      }

      return result
    } catch (error: any) {
      addLog(item.passportNo, "failed", error.message)
      return {
        ...item,
        status: "failed",
        apiResponse: {
          success: false,
          message: error.message,
          errorDetails: error.message,
        },
      }
    }
  }

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const startQuery = async () => {
    const items = parseIdentityNumbers(identityNumbers)
    if (items.length === 0) return

    setIsRunning(true)
    setIsPaused(false)
    pausedRef.current = false
    stopRequestedRef.current = false
    setTotalQueries(items.length)
    setCompletedQueries(0)
    setFailedQueries(0)
    setResults([])
    setLogs([])

    let completed = 0
    let failed = 0
    const allResults: QueryResult[] = []

    try {
      for (let i = 0; i < items.length; i += batchSize) {
        while (pausedRef.current && !stopRequestedRef.current) {
          await delay(100)
        }

        if (stopRequestedRef.current) {
          break
        }

        const batch = items.slice(i, i + batchSize)

        const queryFunctions = batch.map((item) => () => queryAPI(item))

        const batchResults = await Promise.all(queryFunctions.map((fn) => fn()))

        batchResults.forEach((result) => {
          allResults.push(result)
          completed++
          if (result.status === "failed") {
            failed++
          }
        })

        setCompletedQueries(completed)
        setFailedQueries(failed)
        setResults([...allResults])

        if (i + batchSize < items.length && delayMs > 0) {
          await delay(delayMs)
        }
      }

      if (!stopRequestedRef.current) {
        alert(`Tamamlandı: ${completed} sorgu tamamlandı, ${failed} sorgu başarısız oldu.`)
      }
    } catch (error: any) {
      alert("Hata: Sorgu işlemi sırasında bir hata oluştu")
    } finally {
      setIsRunning(false)
      setIsPaused(false)
      pausedRef.current = false
      stopRequestedRef.current = false
    }
  }

  const pauseQuery = () => {
    pausedRef.current = true
    setIsPaused(true)
  }

  const resumeQuery = () => {
    pausedRef.current = false
    setIsPaused(false)
  }

  const stopQuery = () => {
    stopRequestedRef.current = true
    setIsRunning(false)
    setIsPaused(false)
    pausedRef.current = false
  }

  const downloadExcel = async () => {
    if (results.length === 0) {
      alert("Uyarı: İndirilecek sonuç bulunamadı")
      return
    }

    const headers = [
      "Ülke Kodu",
      "Pasaport No",
      "Sorgu Sonucu",
      "Türkiye'de Mi",
      "Kesin Karar",
      "Son Giriş Tarihi",
      "Son Çıkış Tarihi",
      "Hata Detayı",
    ]
    const rows = results.map((result) => [
      result.egmCountryCode,
      result.passportNo,
      result.apiResponse?.success ? "Başarılı" : "Hatalı",
      result.apiResponse?.data?.turkiyedeMi ? "Evet" : "Hayır",
      result.apiResponse?.data?.kesinKarar ? "Evet" : "Hayır",
      formatDate(result.apiResponse?.data?.ulkeyeSonGirisTarihi) || "",
      formatDate(result.apiResponse?.data?.ulkedenSonCikisTarihi) || "",
      result.apiResponse?.errorDetails || "",
    ])

    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n")

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `egm-sorgu-sonuclari-${new Date().toISOString().split("T")[0]}.csv`
    link.click()

    alert("Başarılı: Excel dosyası indirildi")
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setIdentityNumbers(content)
    }
    reader.readAsText(file)
  }

  const progressPercentage = totalQueries > 0 ? (completedQueries / totalQueries) * 100 : 0

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="text-center">
          <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
            EGM Giriş/Çıkış Sorgulama Sistemi
          </h1>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>Kimlik Numaraları</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="identityNumbers" className="text-sm text-muted-foreground mb-2 block">
                  Bilgileri girin (her satıra bir nesne veya virgülle ayırın)
                </Label>
                <textarea id="identityNumbers"
                  placeholder='Örnek:&#10;[{"egmCountryCode": "SRB", "passportNo": "123456789"}]'
                  value={identityNumbers}
                  onChange={(e) => setIdentityNumbers(e.target.value)}
                  className="min-h-[200px] font-mono text-sm resize-none w-full border border-input bg-background px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={isRunning} />
                {/* <Textarea
                  id="identityNumbers"
                  placeholder='Örnek:&#10;[{"egmCountryCode": "SRB", "passportNo": "123456789"}]'
                  value={identityNumbers}
                  onChange={(e) => setIdentityNumbers(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                  disabled={isRunning}
                /> */}
              </div>

              <div className="grid grid-cols-1 w-full gap-5">
                <Input
                  type="file"
                  accept=".txt,.json,.csv"
                  onChange={handleFileUpload}
                  className="hidden w-ful"
                  id="file-upload"
                  disabled={isRunning}
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("file-upload")?.click()}
                  disabled={isRunning}
                  className="w-full "
                >
                  <Upload className="mr-2 h-4 w-4" />
                  CSV/TXT Yükle
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="delay">Gecikme (ms)</Label>
                  <Input
                    id="delay"
                    type="number"
                    min="0"
                    value={delayMs}
                    onChange={(e) => setDelayMs(Number(e.target.value))}
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <Label htmlFor="batchSize">Eşzamanlılık</Label>
                  <Input
                    id="batchSize"
                    type="number"
                    min="1"
                    max="10"
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    disabled={isRunning}
                  />
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                Geçerli kimlik numaraları: <span className="font-semibold">{totalQueries} adet</span>
              </div>
            </CardContent>
          </Card>

          {/* Progress and Controls Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>İlerleme Durumu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">{totalQueries}</div>
                    <div className="text-sm text-muted-foreground">Toplam</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{completedQueries}</div>
                    <div className="text-sm text-muted-foreground">Tamamlanan</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-destructive">{failedQueries}</div>
                    <div className="text-sm text-muted-foreground">Başarısız</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">İlerleme</span>
                    <span className="font-semibold">{progressPercentage.toFixed(1)}% tamamlandı</span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Kontroller</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isRunning ? (
                  <Button onClick={startQuery} disabled={!identityNumbers.trim()} className="w-full" size="lg">
                    <Play className="mr-2 h-5 w-5" />
                    Sorgulamayı Başlat
                  </Button>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {!isPaused ? (
                      <Button onClick={pauseQuery} variant="outline" size="lg">
                        <Pause className="mr-2 h-5 w-5" />
                        Duraklat
                      </Button>
                    ) : (
                      <Button onClick={resumeQuery} size="lg">
                        <Play className="mr-2 h-5 w-5" />
                        Devam Et
                      </Button>
                    )}
                    <Button onClick={stopQuery} variant="destructive" size="lg">
                      <Square className="mr-2 h-5 w-5" />
                      Durdur
                    </Button>
                  </div>
                )}

                <Button
                  onClick={downloadExcel}
                  disabled={results.length === 0}
                  variant="secondary"
                  className="w-full"
                  size="lg"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Excel Olarak İndir
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Results Table 
        <Card>
          <CardHeader>
            <CardTitle>Sorgu Sonuçları ({results.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">Henüz sonuç yok</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ülke Kodu</TableHead>
                      <TableHead>Pasaport No</TableHead>
                      <TableHead>Sorgu Sonucu</TableHead>
                      <TableHead>Türkiye'de Mi</TableHead>
                      <TableHead>Kesin Karar</TableHead>
                      <TableHead>Son Giriş Tarihi</TableHead>
                      <TableHead>Son Çıkış Tarihi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{result.egmCountryCode}</TableCell>
                        <TableCell>{result.passportNo}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              result.apiResponse?.success
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                          >
                            {result.apiResponse?.success ? "Başarılı" : "Hatalı"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {result.apiResponse?.success ? (
                            <span
                              className={
                                result.apiResponse.data?.turkiyedeMi
                                  ? "text-green-600 font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              {result.apiResponse.data?.turkiyedeMi ? "Evet" : "Hayır"}
                            </span>
                          ) : (
                            <span className="text-destructive text-sm">{result.apiResponse?.errorDetails}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {result.apiResponse?.success && (
                            <span
                              className={result.apiResponse.data?.kesinKarar ? "font-medium" : "text-muted-foreground"}
                            >
                              {result.apiResponse.data?.kesinKarar ? "Evet" : "Hayır"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {result.apiResponse?.success && formatDate(result.apiResponse.data?.ulkeyeSonGirisTarihi)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {result.apiResponse?.success && formatDate(result.apiResponse.data?.ulkedenSonCikisTarihi)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>*/}

        {/* Request Logs 
        <Card>
          <CardHeader>
            <CardTitle>İstek Logları</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Henüz log yok</div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">{log.timestamp}</span>
                      <span className="font-medium">{log.passportNo}</span>
                      <span className="text-muted-foreground">{log.message}</span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        log.status === "success"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {log.status === "success" ? "Başarılı" : "Başarısız"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>*/}
      </div>
    </div>
  )
}
