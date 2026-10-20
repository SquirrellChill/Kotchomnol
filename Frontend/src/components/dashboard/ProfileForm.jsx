import { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

export default function ProfileForm({ profile, onSubmit, saving = false, status = '' }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    phoneNumber: profile.phone || '',
    email: profile.email || '',
    shopName: profile.businessName || '',
  });

  useEffect(() => {
    setForm({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      phoneNumber: profile.phone || '',
      email: profile.email || '',
      shopName: profile.businessName || '',
    });
  }, [profile]);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <form className="profile-form" onSubmit={handleSubmit}>
      {status && <p className="review-error-message">{status}</p>}
      <label className="dash-field">
        <span>{t('shopName')}</span>
        <input name="shopName" value={form.shopName} onChange={handleChange} maxLength={150} placeholder={t('shopNamePlaceholder')} />
      </label>
      <label className="dash-field">
        <span>{t('firstName')}</span>
        <input name="firstName" value={form.firstName} onChange={handleChange} required />
      </label>
      <label className="dash-field">
        <span>{t('lastName')}</span>
        <input name="lastName" value={form.lastName} onChange={handleChange} required />
      </label>
      <label className="dash-field">
        <span>{t('phoneNumber')}</span>
        <input name="phoneNumber" value={form.phoneNumber} onChange={handleChange} required />
      </label>
      <label className="dash-field">
        <span>{t('emailAddress')}</span>
        <input type="email" name="email" value={form.email} onChange={handleChange} />
      </label>
      <section className="screen-actions two-col">
        <button className="outline-action" type="reset" disabled={saving}>{t('cancel')}</button>
        <button className="primary-action" type="submit" disabled={saving}>
          {saving ? t('saving') : t('saveChanges')}
        </button>
      </section>
    </form>
  );
}
