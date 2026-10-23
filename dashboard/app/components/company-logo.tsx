"use client";

import { useState } from "react";
import { prettyCompany } from "@/lib/format";
import { companyDomain, logoUrl } from "@/lib/logos";

// Pastel tiles for the initials fallback, picked by name so a company always gets the same one
const TINTS = ["bg-lavender", "bg-sky", "bg-mint", "bg-butter", "bg-peach", "bg-cyan"];

const SIZES = {
  sm: "size-8 rounded-lg text-xs",
  md: "size-10 rounded-xl text-sm",
  lg: "size-14 rounded-2xl text-lg",
};

export function CompanyLogo({ company, url, size = "md" }: { company: string; url?: string; size?: keyof typeof SIZES }) {
  const domain = companyDomain(company, url);
  const [failed, setFailed] = useState(false);
  const name = prettyCompany(company);
  const hash = [...company].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center overflow-hidden border border-rule font-bold text-ink ${SIZES[size]} ${
        domain && !failed ? "bg-surface" : TINTS[hash % TINTS.length]
      }`}
    >
      {domain && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny external favicon, next/image adds nothing here
        <img src={logoUrl(domain)} alt="" loading="lazy" className="size-3/5 object-contain" onError={() => setFailed(true)} />
      ) : (
        name.charAt(0)
      )}
    </span>
  );
}
