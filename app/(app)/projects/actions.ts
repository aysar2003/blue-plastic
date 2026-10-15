'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { formValues, toFormState, type FormState } from '@/components/forms/action-state'
import {
  projectSchema,
  projectStatusSchema,
  projectUpdateSchema,
} from '@/lib/validation/project'
import { action } from '@/server/action'
import * as projectService from '@/server/services/project.service'

function revalidateProjects(id?: string) {
  revalidatePath('/projects')
  revalidatePath('/projects/list')
  if (id) revalidatePath(`/projects/${id}`)
}

export const createProject = action
  .requires('project:create')
  .input(projectSchema)
  .handler(async (ctx, input) => {
    const row = await projectService.create(ctx, input)
    revalidateProjects(row.id)
    return row
  })

export const updateProject = action
  .requires('project:update')
  .input(projectUpdateSchema)
  .handler(async (ctx, input) => {
    const { id, ...rest } = input
    const row = await projectService.update(ctx, id, rest)
    revalidateProjects(row.id)
    return row
  })

export const setProjectStatus = action
  .requires('project:update')
  .input(projectStatusSchema)
  .handler(async (ctx, input) => {
    const row = await projectService.setStatus(ctx, input.id, input.status)
    revalidateProjects(row.id)
    return row
  })

export async function createProjectForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await createProject(formValues(formData))
  if (result.ok) {
    redirect(`/projects/${result.data.id}`)
  }
  return toFormState(result, 'Project created.')
}

export async function updateProjectForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await updateProject(formValues(formData)), 'Project updated.')
}

export async function setProjectStatusForm(_prev: FormState, formData: FormData): Promise<FormState> {
  return toFormState(await setProjectStatus(formValues(formData)), 'Status updated.')
}
