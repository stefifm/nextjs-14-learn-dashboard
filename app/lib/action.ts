'use server'
import { z } from "zod";
import { sql } from "@vercel/postgres"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    required_error: "Please select a customer",
    invalid_type_error: "Please select a valid customer",
  }),
  amount: z.coerce.number().gt(0, {message: "Amount must be greater than 0"}),
  status: z.enum(["pending", "paid"], {
    required_error: "Please select a status",
    invalid_type_error: "Please select a valid status",
  }),
  date: z.string(),
})

const CreateInvoice = FormSchema.omit({ id: true, date: true})

export type State = {
  errors?: {
    customerId?: string[]
    amount?: string[]
    status?: string[]
  }
  message?: string | null
}

export const createInvoice = async (prevState: State, formData: FormData) => {
  const validatedFields = CreateInvoice.safeParse(Object.fromEntries(formData.entries()))


  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }


  const { customerId, amount, status } = validatedFields.data
  const amountInCents = amount * 100
  const date = new Date().toISOString().split("T")[0]

  try {
    await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `
  } catch (error) {
    return {
      message: "Failed to create invoice. Please try again.",
    }
    
  }

  revalidatePath("/dashboard/invoices")
  redirect("/dashboard/invoices")
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true})

export const updateInvoice = async (id: string, prevState: State, formData: FormData) => {
  const validatedFields = UpdateInvoice.safeParse(Object.fromEntries(formData.entries()))
  
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
    };
  }

  
  const { customerId, amount, status } = validatedFields.data
  const amountInCents = amount * 100

  try {
    await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `
  } catch (error) {
    return {
      message: "Failed to delete invoice. Please try again.",
    }
    
  }

  revalidatePath("/dashboard/invoices")
  redirect("/dashboard/invoices")
}

export const deleteInvoice = async (id: string) => {
  try {
    await sql`
    DELETE FROM invoices
    WHERE id = ${id}
  `
  } catch (error) {
    return {
      message: "Failed to delete invoice. Please try again.",
    }
    
  }
  revalidatePath("/dashboard/invoices")
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}