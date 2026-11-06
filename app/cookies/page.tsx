import { LegalPage } from "@/app/components/legal-page";

export const metadata = { title: "Cookies | RUGBY - HUB" };

export default function CookiesPage() {
  return <LegalPage eyebrow="COOKIES" title="Política de cookies" updated="17 de octubre de 2026" sections={[
    { title: "Qué son las cookies", content: <p>Las cookies son pequeños archivos que se almacenan en tu dispositivo para permitir el funcionamiento de un sitio web o recordar determinadas preferencias.</p> },
    { title: "Cookies utilizadas", content: <p>La aplicación utiliza cookies técnicas estrictamente necesarias para gestionar la sesión, la autenticación y la seguridad del acceso. Actualmente no se incorporan cookies de analítica, publicidad o perfilado propias.</p> },
    { title: "Gestión", content: <p>Las cookies técnicas necesarias no requieren consentimiento porque resultan imprescindibles para prestar el servicio solicitado. Puedes eliminarlas o bloquearlas desde la configuración de tu navegador, aunque algunas funciones de acceso podrían dejar de funcionar correctamente.</p> },
    { title: "Cambios", content: <p>Si se incorporan cookies no necesarias, se mostrará un mecanismo de consentimiento antes de activarlas y se actualizará esta política con su información específica.</p> },
  ]} />;
}
