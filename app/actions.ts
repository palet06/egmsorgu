"use server"

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

function isInvalidParameter(value: string): boolean {
  if (!value || value.trim() === "") return true
  const invalidValues = ["KimlikNoBulunamadı", "VeriYok", "0", "-"]
  return invalidValues.includes(value.trim())
}

export async function queryEGMAPI(item: QueryItem): Promise<QueryResult> {
  if (isInvalidParameter(item.egmCountryCode) || isInvalidParameter(item.passportNo)) {
    return {
      ...item,
      status: "failed",
      apiResponse: {
        success: false,
        message: "BAŞARISIZ",
        errorDetails: "PARAMETRE EKSİKLİĞİNDEN DOLAYI SORGU YAPILAMADI",
      },
    }
  }

  try {
    const apiEndpoint = process.env.EGM_API_ENDPOINT
    const apiKey = process.env.EGM_API_KEY

    if (!apiEndpoint || !apiKey) {
      throw new Error("API endpoint veya API key yapılandırılmamış")
    }

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ApiKey: apiKey,
      },
      body: JSON.stringify(item),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const apiResponse: APIResponse = await response.json()

    return {
      ...item,
      status: apiResponse.success ? "success" : "failed",
      apiResponse,
    }
  } catch (error: any) {
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
