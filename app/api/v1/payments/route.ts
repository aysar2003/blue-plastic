import { invokeCapability, readJsonBody } from '@/server/api/v1/dispatch'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  return invokeCapability(request, 'payment.create', await readJsonBody(request))
}
