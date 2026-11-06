import { LegalPage } from "@/app/components/legal-page";

export const metadata = { title: "Aviso legal | RUGBY - HUB" };

export default function AvisoLegalPage() {
  return <LegalPage eyebrow="INFORMACIÓN LEGAL" title="Aviso legal" updated="17 de octubre de 2026" sections={[
    { title: "Titularidad", content: <><p>Este sitio web y la aplicación CTRUGBY - HUB son titularidad de <strong>XXXX</strong>.</p><ul className="list-disc space-y-1 pl-5"><li>NIF/CIF: <strong>XXXX</strong></li><li>Domicilio: <strong>XXXX</strong></li><li>Correo electrónico: <strong>XXXX</strong></li></ul></> },
    { title: "Objeto", content: <p>CTRUGBY - HUB ofrece un directorio y herramientas de consulta y gestión vinculadas al rugby. El contenido se facilita con carácter informativo y operativo dentro de las funcionalidades disponibles en la aplicación.</p> },
    { title: "Uso del sitio", content: <p>La persona usuaria se compromete a utilizar la aplicación de manera lícita, diligente y respetuosa, sin afectar a los derechos de terceros, la seguridad del servicio ni la integridad de sus datos.</p> },
    { title: "Propiedad intelectual", content: <p>Los textos, diseños, elementos gráficos, bases de datos y demás contenidos de la aplicación pertenecen a XXXX o se utilizan con autorización. No se permite su reproducción, distribución o transformación sin autorización previa, salvo los usos permitidos por la ley.</p> },
    { title: "Responsabilidad", content: <p>XXXX procurará que la información esté actualizada y que el servicio funcione correctamente, pero no garantiza la ausencia de errores, interrupciones o la disponibilidad permanente. Las fuentes externas enlazadas son responsabilidad de sus respectivos titulares.</p> },
    { title: "Legislación aplicable", content: <p>Este aviso se rige por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales que resulten competentes conforme a la normativa aplicable.</p> },
  ]} />;
}
