import { fapshiProvider } from "./providers/fapshi";
import { sandboxProvider } from "./providers/sandbox";
import { PaymentConfigurationError, type Currency, type PaymentProvider, type ProviderId } from "./types";

export * from "./types";

/** Registry — add a provider here without touching the booking code. */
const providers: Record<ProviderId, PaymentProvider> = {
  sandbox: sandboxProvider,
  fapshi: fapshiProvider,
};

export function getProvider(id: string): PaymentProvider | null {
  return (providers as Record<string, PaymentProvider>)[id] ?? null;
}

/** Active provider: PAYMENT_PROVIDER = sandbox | fapshi (PAYMENT_PROVIDER_XAF still accepted). */
export const activeProviderId = () => process.env.PAYMENT_PROVIDER || process.env.PAYMENT_PROVIDER_XAF || "sandbox";

export function providerForCurrency(currency: Currency): PaymentProvider {
  const provider = getProvider(activeProviderId());
  if (!provider || !provider.supports(currency)) {
    throw new PaymentConfigurationError(`No payment provider configured for ${currency} (Fapshi accepts XAF only)`);
  }
  if (!provider.isConfigured()) {
    throw new PaymentConfigurationError(
      provider.id === "sandbox"
        ? "Live payments require configuration (sandbox disabled in production)."
        : `${provider.label} is not configured. Add its credentials to the environment.`,
    );
  }
  return provider;
}

export function paymentsAreLive(): boolean {
  return activeProviderId() !== "sandbox";
}
