import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Callback received' 
    }, { status: 200 })
    
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to process callback' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Callback endpoint is active',
    timestamp: new Date().toISOString()
  })
}
