import {
  clearSession,
  currentUser,
  login,
  register,
  setSession,
} from "@/lib/auth";
import { body, failure, json } from "@/lib/http";
import { AppError } from "@/lib/domain";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    if (action !== "sesion") throw new AppError("No encontrado.", 404);
    return json({ user: await currentUser() });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    const data = await body(request);
    if (action === "salir") {
      await clearSession();
      return json({ ok: true });
    }
    if (action !== "registro" && action !== "ingresar")
      throw new AppError("No encontrado.", 404);
    const user =
      action === "registro" ? await register(data) : await login(data);
    await setSession(user.id);
    return json({ user }, action === "registro" ? 201 : 200);
  } catch (e) {
    return failure(e);
  }
}
