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

export async function queryEGMAPI(item: QueryItem): Promise<QueryResult> {
  try {
    const apiEndpoint = process.env.EGM_API_ENDPOINT
    const apiKey = process.env.EGM_API_KEY
    console.log(apiEndpoint,apiKey)
    console.log(item)

    if (!apiEndpoint || !apiKey) {
      throw new Error("API endpoint veya API key yapılandırılmamış")
    }

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ApiKey: `${apiKey}`,
      },
      body: JSON.stringify(item),
    })
    console.log(response)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const apiResponse: APIResponse = await response.json()
    console.log(apiResponse)

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
