export const DISPOSAL_SOURCES = [
  {
    name: 'MPCB: electronic waste resources and recycler lists',
    url: 'https://www.mpcb.gov.in/en/node/4297',
  },
  { name: 'CPCB: e-waste registration portal', url: 'https://eprewaste.cpcb.gov.in/' },
  {
    name: 'BMC: waste management services',
    url: 'https://www.mcgm.gov.in/irj/portal/anonymous/qlcleanover?guest_user=english',
  },
  { name: 'Swachhata: official civic reporting', url: 'https://www.swachh.city/' },
];
export function handlingFor(category, special = false, context = 'PUBLIC_SPACE') {
  if (special)
    return {
      stream: 'SPECIALIST',
      title: 'Specialist review required',
      message:
        'Keep batteries, chemicals, medical waste and sharp items separate. Do not dismantle or handle damaged items. The operator must arrange a suitable specialist and record the receiving facility before closure.',
    };
  if (category === 'E_WASTE')
    return {
      stream: 'E_WASTE',
      title: 'Electronics need a separate handoff',
      message:
        'Keep electronics separate from ordinary waste. Use a manufacturer take-back service or a currently registered recycler. Back up and erase personal data where safe. Do not dismantle devices or remove damaged batteries. A request here does not book a pickup.',
    };
  if (category === 'UNKNOWN')
    return {
      stream: 'REVIEW',
      title: 'Operator classification needed',
      message:
        'An operator will identify a suitable collection stream before this request can enter a route.',
    };
  if (context === 'HOUSEHOLD')
    return {
      stream: 'HOUSEHOLD',
      title: 'Household disposal request',
      message:
        'Keep items separated and dry where appropriate. Your address is available only to you and operators. The operator must confirm a receiving service before marking this request complete.',
    };
  if (category === 'ORGANIC')
    return {
      stream: 'ORGANIC',
      title: 'Wet / organic collection',
      message:
        'Keep organic waste separate from dry recyclables and electronics. The operator will use a compatible collection vehicle.',
    };
  if (category === 'MIXED')
    return {
      stream: 'MIXED',
      title: 'Mixed waste requires review',
      message:
        'The operator checks material and hazards before collection. Electronics and hazardous items must be referred separately.',
    };
  return {
    stream: 'DRY',
    title: 'Dry recyclable collection',
    message:
      'Keep dry material separate from food and wet waste. Flag sharp glass or other hazards for specialist review.',
  };
}
export function requiresHandoff(event) {
  return (
    event.category === 'E_WASTE' ||
    event.requiresSpecialHandling ||
    event.reportContext === 'HOUSEHOLD'
  );
}
