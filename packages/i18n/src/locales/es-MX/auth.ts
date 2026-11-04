/** Mexican Spanish messages of the `auth` area. Source of the `auth.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const auth = {
  // Web sign-in (W1), password reset, organization choice and session expiry (#28)
  "auth.login.title": "Inicia sesión",
  "auth.login.username": "Usuario",
  "auth.login.password": "Contraseña",
  "auth.login.showPassword": "Mostrar contraseña",
  "auth.login.submit": "Entrar",
  "auth.login.submitting": "Entrando…",
  "auth.login.forgot": "Olvidé mi contraseña",
  "auth.login.noSignUp": "Las cuentas las da de alta el administrador de tu organización.",
  "auth.login.usernameRequired": "Escribe tu usuario.",
  "auth.login.passwordRequired": "Escribe tu contraseña.",
  "auth.login.invalidCredentials": "El usuario o la contraseña no coinciden.",
  "auth.login.invalidCredentialsHint": "Revísalos e inténtalo de nuevo.",
  "auth.login.noMembership":
    "Tu cuenta no tiene acceso activo a una organización. Contacta a tu administrador.",
  "auth.login.passwordChanged": "Tu contraseña se actualizó. Inicia sesión con la nueva.",
  "auth.login.program": "Programa Wolbachia",
  "auth.login.headline": "Plataforma de operación y vigilancia entomológica",
  "auth.login.tagline": "Aquí la oficina prepara, controla y analiza lo que pasa en campo.",
  "auth.login.standards": "NOM-032-SSA2-2014 · Guías CENAPRECE 2024",
  "auth.lockout.message": "Demasiados intentos. Espera {minutes} min e inténtalo de nuevo.",
  "auth.lockout.noWait": "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  "auth.lockout.hint":
    "Si olvidaste tu contraseña, puedes restablecerla desde el enlace de abajo o pedir ayuda a tu administrador.",
  "auth.forgot.title": "Restablece tu contraseña",
  "auth.forgot.body":
    "Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.",
  "auth.forgot.email": "Correo electrónico",
  "auth.forgot.emailInvalid": "Escribe un correo válido, por ejemplo nombre@empresa.com.",
  "auth.forgot.submit": "Enviar enlace",
  "auth.forgot.sentTitle": "Revisa tu correo",
  "auth.forgot.sent":
    "Si ese correo está registrado, te enviamos un enlace para restablecer tu contraseña. Puede tardar unos minutos; revisa también la carpeta de spam.",
  "auth.forgot.backToLogin": "Volver a iniciar sesión",
  "auth.reset.title": "Elige una contraseña nueva",
  "auth.reset.newPassword": "Contraseña nueva",
  "auth.reset.confirmPassword": "Confirma la contraseña",
  "auth.reset.hint": "Usa una contraseña larga y que no sea fácil de adivinar.",
  "auth.reset.submit": "Guardar contraseña",
  "auth.reset.required": "Escribe una contraseña.",
  "auth.reset.mismatch": "Las contraseñas no coinciden.",
  "auth.reset.passwordTooShort": "La contraseña es demasiado corta. Usa una más larga.",
  "auth.reset.passwordTooCommon": "Esa contraseña es muy común. Elige otra.",
  "auth.reset.passwordEntirelyNumeric": "La contraseña no puede ser solo números.",
  "auth.reset.passwordTooSimilar": "La contraseña se parece demasiado a tus datos. Elige otra.",
  "auth.reset.invalidLinkTitle": "Este enlace ya no sirve",
  "auth.reset.invalidLinkBody":
    "El enlace venció, ya se usó o no es válido. Pide uno nuevo para continuar.",
  "auth.reset.requestNew": "Pedir un enlace nuevo",
  "auth.organization.title": "Elige tu organización",
  "auth.organization.body":
    "Tu cuenta pertenece a varias organizaciones. Elige con cuál quieres trabajar ahora.",
  "auth.organization.legend": "Organizaciones disponibles",
  "auth.organization.submit": "Continuar",
  "auth.session.title": "Tu sesión terminó",
  "auth.session.body":
    "Por seguridad cerramos tu sesión. Escribe tu contraseña para continuar; lo que tenías sin guardar se conserva.",
  "auth.session.submit": "Continuar",
  "auth.session.signOut": "Cerrar sesión",
} as const satisfies AreaCatalog<"auth">;
