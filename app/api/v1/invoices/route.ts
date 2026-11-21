import { invokeCapability, queryObject, readJsonBody } from '@/server/api/v1/dispatch'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return invokeCapability(request, 'invoices.list', queryObject(request))
}

export async function POST(request: Request) {
  return invokeCapability(request, 'invoices.create', await readJsonBody(request))
}
