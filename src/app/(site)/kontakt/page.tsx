import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/components/site";
import { ContentPage } from "@/components/ui";

export const metadata: Metadata = {
  title: "Kontakt",
  description: "Skontaktuj się z PismoGotowe – pytania o działanie serwisu, płatności i reklamacje.",
  alternates: { canonical: "/kontakt" },
};

export default function ContactPage() {
  return (
    <ContentPage title="Kontakt" lead="Masz pytanie o działanie serwisu, płatność albo chcesz złożyć reklamację? Napisz do nas.">
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-navy-100 bg-white p-6">
          <h2 className="text-lg font-semibold text-navy-900">E-mail</h2>
          <p className="mt-2 text-gray-700">
            <span className="font-medium text-navy-900">{CONTACT_EMAIL}</span>
          </p>
          <p className="mt-2 text-sm text-gray-600">Odpowiadamy w dni robocze, zwykle w ciągu [24–48 godzin].</p>
          <p className="mt-4 text-sm text-gray-600">
            Jeśli piszesz w sprawie konkretnego pisma, dołącz <strong>link do dokumentu</strong> – bez niego nie
            odnajdziemy Twojego zamówienia.
          </p>
        </section>
        <section className="rounded-xl border border-navy-100 bg-white p-6">
          <h2 className="text-lg font-semibold text-navy-900">Dane firmy</h2>
          <address className="mt-2 not-italic leading-relaxed text-gray-700">
            [DANE FIRMY – nazwa]
            <br />
            [ADRES SIEDZIBY]
            <br />
            NIP: [NIP] · REGON: [REGON]
          </address>
        </section>
        <section className="rounded-xl border border-navy-100 bg-white p-6">
          <h2 className="text-lg font-semibold text-navy-900">Reklamacje</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">
            Reklamacje rozpatrujemy w ciągu 14 dni. Opisz problem i dołącz link do pisma. Szczegóły w{" "}
            <Link href="/regulamin" className="font-medium text-navy-700 underline underline-offset-2">
              regulaminie
            </Link>
            .
          </p>
        </section>
        <section className="rounded-xl border border-accent-200 bg-accent-50 p-6">
          <h2 className="text-lg font-semibold text-navy-900">Nie udzielamy porad prawnych</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">
            Nie możemy ocenić Twojej sprawy ani doradzić, jak postąpić. Bezpłatną pomoc prawną oferują m.in. miejscy
            i powiatowi rzecznicy konsumentów oraz punkty nieodpłatnej pomocy prawnej.
          </p>
        </section>
      </div>
    </ContentPage>
  );
}
