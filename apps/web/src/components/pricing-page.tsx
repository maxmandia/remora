import type { PublicPricingCatalog } from "../lib/public-pricing";
import { LandingNavigation } from "./landing-navigation";
import { MacosDownloadButton } from "./macos-download-button";
import { SiteFooter } from "./site-footer";

type PricingModel = PublicPricingCatalog["models"][number];
type PricingRate = PricingModel["rates"][number];

export function PricingPage({
  catalog,
}: {
  catalog: PublicPricingCatalog | null;
}) {
  const surchargePercentage = catalog
    ? formatSurchargePercentage(catalog.surchargeBasisPoints)
    : "";
  const examplePricing = catalog
    ? calculateExamplePricing(catalog.surchargeBasisPoints)
    : null;
  const imageModels =
    catalog?.models.filter((model) => model.modelType === "image") ?? [];
  const videoModels =
    catalog?.models.filter((model) => model.modelType === "video") ?? [];
  const hasTokenRates =
    catalog?.models.some((model) =>
      model.rates.some((rate) => rate.quantityUnit === "token"),
    ) ?? false;

  return (
    <main className="flex min-h-svh flex-col bg-[#101111] px-5 py-6 text-[#f7f3eb] sm:px-8 lg:px-10">
      <LandingNavigation activeItem="pricing" />

      <section className="mx-auto grid w-full max-w-7xl gap-12 py-16 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.72fr)] lg:items-end lg:gap-20 lg:py-28">
        <div className="max-w-3xl">
          <p className="text-xs font-medium tracking-[0.18em] text-[#8f8e89] uppercase">
            Transparent pricing
          </p>
          <h1 className="mt-5 text-5xl leading-[0.98] font-medium tracking-[-0.045em] text-balance sm:text-6xl lg:text-7xl">
            {surchargePercentage
              ? `Provider price + ${surchargePercentage}.`
              : "Provider price + one flat fee."}
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 font-light text-[#aaa8a2] sm:text-lg sm:leading-8">
            {surchargePercentage ? (
              <>
                Every model follows the same formula. We pass through the
                upstream provider&apos;s price and add one flat{" "}
                {surchargePercentage} fee.
              </>
            ) : (
              <>
                Every model follows the same formula: the upstream
                provider&apos;s price plus one flat fee.
              </>
            )}
          </p>
          <a
            href="#model-pricing"
            className="mt-8 inline-flex rounded-sm text-sm text-[#e5e1d9] underline decoration-white/30 underline-offset-4 transition-colors hover:text-white hover:decoration-white focus-visible:ring-2 focus-visible:ring-[#8da0dc] focus-visible:outline-none"
          >
            See model pricing{" "}
            <span aria-hidden="true" className="ml-1">
              ↓
            </span>
          </a>
        </div>

        {examplePricing ? (
          <div
            aria-label={`Example pricing calculation: Provider cost ${examplePricing.providerCost} plus Remora fee ${examplePricing.remoraFee} equals ${examplePricing.customerCost}`}
            className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"
          >
            <p className="text-xs tracking-[0.16em] text-[#777570] uppercase">
              One formula for every model
            </p>
            <div className="mt-8 grid grid-cols-[1fr_auto] gap-x-6 gap-y-5 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-end sm:gap-x-4">
              <FormulaValue
                label="Provider cost"
                value={examplePricing.providerCost}
              />
              <span
                aria-hidden="true"
                className="self-end pb-1 text-xl text-[#5f5e5a]"
              >
                +
              </span>
              <FormulaValue
                label="Remora fee"
                value={examplePricing.remoraFee}
              />
              <span
                aria-hidden="true"
                className="self-end pb-1 text-xl text-[#5f5e5a]"
              >
                =
              </span>
              <FormulaValue
                emphasized
                label="You pay"
                value={examplePricing.customerCost}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section
        id="model-pricing"
        aria-labelledby="model-pricing-heading"
        className="mx-auto w-full max-w-7xl scroll-mt-8 border-t border-white/10 py-16 sm:py-20"
      >
        <header className="max-w-3xl">
          <p className="text-xs font-medium tracking-[0.18em] text-[#8f8e89] uppercase">
            The full ledger
          </p>
          <h2
            id="model-pricing-heading"
            className="mt-4 text-3xl font-medium tracking-[-0.03em] sm:text-4xl"
          >
            Every model, itemized.
          </h2>
          <p className="mt-5 text-base leading-7 font-light text-[#aaa8a2]">
            Rates are shown in USD from Remora&apos;s current published model
            catalog. Different configurations appear as separate rows.
          </p>
        </header>

        {catalog ? (
          catalog.models.length ? (
            <div className="mt-14 space-y-16 sm:mt-16 sm:space-y-20">
              <PricingGroup
                title="Image models"
                models={imageModels}
                surchargePercentage={surchargePercentage}
              />
              <PricingGroup
                title="Video models"
                models={videoModels}
                surchargePercentage={surchargePercentage}
              />

              {hasTokenRates ? (
                <div className="max-w-3xl border-l border-white/15 pl-5 text-sm leading-6 text-[#8f8e89] sm:pl-6">
                  <p className="font-medium text-[#c5c2bb]">
                    About token-based video pricing
                  </p>
                  <p className="mt-2 font-light">
                    Final cost varies with settings and provider-reported usage.
                    Remora shows an estimate before generation, then applies the
                    same {surchargePercentage} fee to the finalized upstream
                    cost.
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <PricingStatus
              title="No published pricing yet"
              description="Published model rates will appear here as they become available."
            />
          )
        ) : (
          <PricingStatus
            title="Pricing details are temporarily unavailable"
            description="Please refresh shortly to see the current model ledger and active Remora fee."
          />
        )}
      </section>

      <section className="mx-auto mb-16 flex w-full max-w-7xl flex-col items-start justify-between gap-7 rounded-2xl border border-white/10 bg-white/[0.025] p-7 sm:mb-20 sm:flex-row sm:items-center sm:p-9">
        <div>
          <h2 className="text-2xl font-medium tracking-[-0.025em]">
            Start creating with Remora.
          </h2>
          <p className="mt-2 text-sm font-light text-[#8f8e89]">
            The desktop app shows an estimated cost before every generation.
          </p>
        </div>
        <MacosDownloadButton text="Download Remora" />
      </section>

      <SiteFooter />
    </main>
  );
}

function FormulaValue({
  emphasized = false,
  label,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-[#777570]">{label}</p>
      <p
        className={
          emphasized
            ? "mt-2 text-3xl font-medium tracking-[-0.03em] text-[#f7f3eb]"
            : "mt-2 text-3xl font-light tracking-[-0.03em] text-[#c5c2bb]"
        }
      >
        {value}
      </p>
    </div>
  );
}

function PricingGroup({
  models,
  surchargePercentage,
  title,
}: {
  models: PricingModel[];
  surchargePercentage: string;
  title: string;
}) {
  if (!models.length) {
    return null;
  }

  return (
    <section aria-label={title}>
      <div className="flex items-end justify-between gap-5 border-b border-white/10 pb-5">
        <h3 className="text-2xl font-medium tracking-[-0.025em] sm:text-3xl">
          {title}
        </h3>
        <p className="text-sm text-[#777570]">
          {models.length} {models.length === 1 ? "model" : "models"}
        </p>
      </div>
      <div className="mt-7 space-y-5">
        {models.map((model) => (
          <ModelPricingCard
            key={model.id}
            model={model}
            surchargePercentage={surchargePercentage}
          />
        ))}
      </div>
    </section>
  );
}

function ModelPricingCard({
  model,
  surchargePercentage,
}: {
  model: PricingModel;
  surchargePercentage: string;
}) {
  const rates = [...model.rates].sort(comparePricingRates);

  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      <header className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7 sm:py-6">
        <div>
          <p className="text-xs tracking-[0.14em] text-[#777570] uppercase">
            {model.providerName}
          </p>
          <h4 className="mt-2 text-xl font-medium tracking-[-0.02em] sm:text-2xl">
            {model.displayName}
          </h4>
        </div>
        <p className="text-xs text-[#777570]">
          {rates.length} {rates.length === 1 ? "rate" : "rates"}
        </p>
      </header>

      <div className="hidden grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] gap-6 border-b border-white/10 px-7 py-3 text-xs tracking-[0.08em] text-[#777570] uppercase md:grid">
        <span>Configuration</span>
        <span>Upstream price</span>
        <span>Remora fee ({surchargePercentage})</span>
        <span>You pay</span>
      </div>

      {rates.length ? (
        <ul className="divide-y divide-white/10">
          {rates.map((rate) => (
            <li key={rate.id} className="px-5 py-6 sm:px-7">
              <dl className="grid gap-5 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] md:items-start md:gap-6">
                <PricingCell
                  label="Configuration"
                  value={formatRateConditions(rate)}
                />
                <PricingCell
                  label="Upstream price"
                  value={formatUsdMicros(rate.upstreamUnitPriceUsdMicros)}
                  detail={formatRateUnit(rate)}
                />
                <PricingCell
                  label={`Remora fee (${surchargePercentage})`}
                  value={`+${formatUsdMicros(
                    rate.remoraFeeUnitPriceUsdMicros,
                  )}`}
                  detail={formatRateUnit(rate)}
                />
                <PricingCell
                  emphasized
                  label="You pay"
                  value={formatUsdMicros(rate.customerUnitPriceUsdMicros)}
                  detail={formatRateUnit(rate)}
                />
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-6 text-sm text-[#777570] sm:px-7">
          Pricing is not available for this model yet.
        </p>
      )}
    </article>
  );
}

function PricingCell({
  detail,
  emphasized = false,
  label,
  value,
}: {
  detail?: string;
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs tracking-[0.08em] text-[#777570] uppercase md:sr-only">
        {label}
      </dt>
      <dd
        className={
          emphasized
            ? "mt-2 text-base font-medium text-[#f7f3eb] md:mt-0"
            : "mt-2 text-sm text-[#c5c2bb] md:mt-0"
        }
      >
        {value}
      </dd>
      {detail ? (
        <dd className="mt-1 text-xs text-[#777570]">{detail}</dd>
      ) : null}
    </div>
  );
}

function PricingStatus({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="mt-12 max-w-3xl rounded-xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
      <h3 className="text-lg font-medium text-[#e5e1d9]">{title}</h3>
      <p className="mt-2 text-sm leading-6 font-light text-[#8f8e89]">
        {description}
      </p>
    </div>
  );
}

function formatRateConditions(rate: PricingRate) {
  const conditions: string[] = [];
  const outputResolution = formatConditionValue(
    rate.conditions.outputResolution,
  );
  const inputVideoResolution = formatConditionValue(
    rate.conditions.inputVideoResolution,
  );

  if (outputResolution) {
    conditions.push(outputResolution);
  }

  if (inputVideoResolution) {
    conditions.push(`Input ${inputVideoResolution}`);
  }

  if (rate.conditions.nativeAudio !== undefined) {
    conditions.push(rate.conditions.nativeAudio ? "Audio on" : "Audio off");
  }

  if (rate.conditions.inputIncludesVideo !== undefined) {
    conditions.push(
      rate.conditions.inputIncludesVideo
        ? "With input video"
        : "Without input video",
    );
  }

  return conditions.length ? conditions.join(" · ") : "Standard";
}

function comparePricingRates(left: PricingRate, right: PricingRate) {
  const resolutionDifference =
    getResolutionRank(left.conditions.outputResolution) -
    getResolutionRank(right.conditions.outputResolution);

  if (resolutionDifference !== 0) {
    return resolutionDifference;
  }

  const inputVideoDifference =
    Number(left.conditions.inputIncludesVideo ?? false) -
    Number(right.conditions.inputIncludesVideo ?? false);

  if (inputVideoDifference !== 0) {
    return inputVideoDifference;
  }

  const audioDifference =
    Number(left.conditions.nativeAudio ?? false) -
    Number(right.conditions.nativeAudio ?? false);

  return audioDifference || left.id.localeCompare(right.id);
}

function getResolutionRank(value: string | string[] | undefined) {
  const resolution = Array.isArray(value) ? value[0] : value;

  if (!resolution) {
    return Number.MAX_SAFE_INTEGER;
  }

  const normalizedResolution = resolution.toLowerCase();
  const namedRanks: Record<string, number> = {
    "480p": 480,
    "512": 512,
    "720p": 720,
    "1k": 1000,
    "1080p": 1080,
    "2k": 2000,
    "4k": 4000,
  };

  return namedRanks[normalizedResolution] ?? Number.MAX_SAFE_INTEGER;
}

function formatConditionValue(value: string | string[] | undefined) {
  if (!value) {
    return value;
  }

  const values = Array.isArray(value) ? value : [value];

  return values
    .map((item) => (/^\d+k$/i.test(item) ? item.toUpperCase() : item))
    .join(" / ");
}

function formatRateUnit(rate: PricingRate) {
  if (rate.quantityUnit === "token" && rate.unitQuantity === 1_000_000) {
    return "per 1M tokens";
  }

  const unit =
    rate.unitQuantity === 1 ? rate.quantityUnit : `${rate.quantityUnit}s`;

  return `per ${rate.unitQuantity === 1 ? "" : `${rate.unitQuantity} `}${unit}`;
}

function formatSurchargePercentage(surchargeBasisPoints: number) {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(surchargeBasisPoints / 100)}%`;
}

function calculateExamplePricing(surchargeBasisPoints: number) {
  const providerCostUsdMicros = 1_000_000;
  const remoraFeeUsdMicros = Math.ceil(
    (providerCostUsdMicros * surchargeBasisPoints) / 10_000,
  );

  return {
    providerCost: formatUsdMicros(providerCostUsdMicros),
    remoraFee: formatUsdMicros(remoraFeeUsdMicros),
    customerCost: formatUsdMicros(providerCostUsdMicros + remoraFeeUsdMicros),
  };
}

function formatUsdMicros(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value / 1_000_000);
}
