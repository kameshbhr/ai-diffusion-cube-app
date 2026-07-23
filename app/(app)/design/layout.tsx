import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/roles';

export default async function DesignLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const isAdopter = await hasRole(supabase, 'adopter');

  if (!isAdopter) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F5EFE6] text-[#2C1A0E] p-8">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-bold mb-2">Design requires the Adopter role</h1>
          <p className="text-sm text-[#7A5C44]">
            Your account doesn&apos;t have Design access yet. Contact an admin if you believe this should be enabled.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
