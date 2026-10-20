export function buildDashboardProfile(user, fallback) {
  if (!user || typeof user !== 'object') return fallback;

  const firstName = user.firstName || user.first_name || fallback.firstName;
  const lastName = user.lastName || user.last_name || '';
  const name = [firstName, lastName].filter(Boolean).join(' ') || user.name || fallback.name;

  return {
    ...fallback,
    name,
    firstName,
    lastName,
    email: user.email || fallback.email,
    phone: user.phoneNumber || user.phone_number || user.phone || fallback.phone,
    businessName: user.shop_name || user.shopName || user.businessName || user.business_name || fallback.businessName,
    role: user.role || fallback.role,
    address: user.address || fallback.address,
  };
}
