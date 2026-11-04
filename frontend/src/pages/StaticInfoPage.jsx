import { useNavigate } from 'react-router-dom';
import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { PrimaryButton } from '../components/ui/PrimaryButton';

export function StaticInfoPage({ title, subtitle, icon, actionText = 'Offer a Ride', actionPath = '/rides/offer' }) {
  const navigate = useNavigate();

  return (
    <ResponsiveShell
      customMobileHeader={<AppHeader title={title} backTo={-1} />}
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-center">
        <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-gray-100 flex flex-col items-center">
          <div className="w-20 h-20 bg-peach/50 rounded-full flex items-center justify-center text-4xl mb-4">
            {icon || '✨'}
          </div>
          <h2 className="font-black text-navy text-2xl sm:text-3xl mb-2">{title}</h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-md mb-8 leading-relaxed">
            {subtitle || 'This section is being updated with real-time campus data.'}
          </p>

          <PrimaryButton
            variant="coral"
            onClick={() => navigate(actionPath)}
            fullWidth={false}
            className="px-8"
          >
            {actionText}
          </PrimaryButton>
        </div>
      </div>
    </ResponsiveShell>
  );
}

export default StaticInfoPage;

