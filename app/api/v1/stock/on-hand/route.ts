import { invokeCapability, queryObject } from '@/server/api/v1/dispatch'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return invokeCapability(request, 'stock.onHand', queryObject(request))
}
