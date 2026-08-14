export interface GstLookupResult {
  gstin: string;
  isValid: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'INVALID' | 'UNVERIFIED';
  legalName: string;
  tradeName: string;
  address: string;
  stateCode: string;
  stateName: string;
  taxpayerType: 'Regular' | 'Composition' | 'SEZ Unit' | 'Input Service Distributor' | 'Unknown';
  registrationDate: string;
  message: string;
}

/** Validates GSTIN structure locally before an online lookup. */
export function validateGstFormat(gstin: string): boolean {
  const clean = gstin.trim().toUpperCase();
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(clean);
}

/**
 * Performs authoritative server-side GSTIN verification through the configured
 * GST/GSP/IRP provider. The browser never calls the provider directly.
 */
export async function lookupGstDetails(gstinInput: string): Promise<GstLookupResult> {
  const gstin = gstinInput.trim().toUpperCase();

  if (!validateGstFormat(gstin)) {
    return {
      gstin,
      isValid: false,
      status: 'INVALID',
      legalName: '',
      tradeName: '',
      address: '',
      stateCode: '',
      stateName: '',
      taxpayerType: 'Unknown',
      registrationDate: '',
      message: 'Invalid GSTIN format.'
    };
  }

  try {
    const response = await fetch(`/api/gst/verify?gstin=${encodeURIComponent(gstin)}`);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        gstin,
        isValid: false,
        status: payload?.status || 'UNVERIFIED',
        legalName: payload?.legalName || '',
        tradeName: payload?.tradeName || '',
        address: payload?.address || '',
        stateCode: payload?.stateCode || '',
        stateName: payload?.stateName || '',
        taxpayerType: payload?.taxpayerType || 'Unknown',
        registrationDate: payload?.registrationDate || '',
        message: payload?.message || 'GST online verification failed.'
      };
    }

    return {
      gstin,
      isValid: payload?.status === 'ACTIVE' && payload?.isValid === true,
      status: payload?.status || 'UNVERIFIED',
      legalName: payload?.legalName || '',
      tradeName: payload?.tradeName || '',
      address: payload?.address || '',
      stateCode: payload?.stateCode || '',
      stateName: payload?.stateName || '',
      taxpayerType: payload?.taxpayerType || 'Unknown',
      registrationDate: payload?.registrationDate || '',
      message: payload?.message || 'GST verification completed.'
    };
  } catch (error) {
    return {
      gstin,
      isValid: false,
      status: 'UNVERIFIED',
      legalName: '',
      tradeName: '',
      address: '',
      stateCode: '',
      stateName: '',
      taxpayerType: 'Unknown',
      registrationDate: '',
      message: error instanceof Error ? error.message : 'Unable to reach GST verification service.'
    };
  }
}
