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

const STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '28': 'Andhra Pradesh',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh',
  '38': 'Ladakh'
};

/**
 * Validates the structural format of an Indian GSTIN.
 * This does NOT verify registration status with the GST portal.
 */
export function validateGstFormat(gstin: string): boolean {
  const clean = gstin.trim().toUpperCase();
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(clean);
}

/**
 * Performs local GSTIN validation only. No fabricated taxpayer identity is returned.
 * Real registration verification should be implemented through an authorized GST API/backend.
 */
export function lookupGstDetails(gstinInput: string): Promise<GstLookupResult> {
  const gstin = gstinInput.trim().toUpperCase();
  const stateCode = gstin.substring(0, 2);
  const stateName = STATE_CODES[stateCode] || '';
  const isValid = validateGstFormat(gstin);

  if (!isValid) {
    return Promise.resolve({
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
      message: 'Invalid GSTIN format. GSTIN must contain 15 characters in the standard format.'
    });
  }

  return Promise.resolve({
    gstin,
    isValid: true,
    status: 'UNVERIFIED',
    legalName: '',
    tradeName: '',
    address: '',
    stateCode,
    stateName,
    taxpayerType: 'Unknown',
    registrationDate: '',
    message: 'GSTIN format is valid. Registration status and taxpayer details require verification through an authorized GST service.'
  });
}
