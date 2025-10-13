import { generateText } from "ai"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { clientMessage, projectName } = await request.json()

    if (!clientMessage) {
      return NextResponse.json({ error: "Client message is required" }, { status: 400 })
    }

    const prompt = `You are an expert project manager analyzing client requests to determine if they fall outside the original project scope.

Project: ${projectName || "General Request"}
Client Message: "${clientMessage}"

Analyze this request and provide:
1. Whether this is out of scope (true/false)
2. Clear reasoning for your decision
3. Estimated hours needed (be realistic)
4. List of specific tasks required
5. Risk level (low/medium/high)

Respond in JSON format:
{
  "isOutOfScope": boolean,
  "reasoning": "string",
  "estimatedHours": number,
  "suggestedTasks": ["task1", "task2"],
  "riskLevel": "low" | "medium" | "high"
}`

    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt,
    })

    // Parse the AI response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response")
    }

    const analysis = JSON.parse(jsonMatch[0])

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error("Analysis error:", error)
    return NextResponse.json({ error: "Failed to analyze request" }, { status: 500 })
  }
}
