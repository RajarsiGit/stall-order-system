import { Link } from 'react-router-dom';
import { usePageTitle } from '../lib/usePageTitle';
import logo from '../assets/logo.svg';

export default function Landing() {
  usePageTitle('FoodCourt Hub');

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="flex flex-col justify-center border-b-2 border-ink bg-paper px-6 py-12 md:border-b-0 md:border-r-2 md:px-12">
        <img src={logo} alt="" className="h-10 w-10" />
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-stone">Hungry?</p>
        <h1 className="mt-2 font-display text-4xl leading-none">Order as a customer</h1>
        <p className="mt-3 max-w-sm text-stone">
          Browse stalls, build your order, and track your ticket to pickup.
        </p>

        <div className="mt-8 max-w-xs space-y-3">
          <Link
            to="/customer/login"
            className="block border-2 border-ink bg-ink px-6 py-3.5 text-center font-medium text-paper hover:bg-paprika hover:border-paprika transition-colors"
          >
            Log in as customer
          </Link>
          <Link
            to="/customer/register"
            className="block border-2 border-ink px-6 py-3.5 text-center font-medium text-ink hover:bg-ink hover:text-paper transition-colors"
          >
            New here? Register
          </Link>
        </div>

        <Link to="/track" className="mt-6 text-sm text-stone underline decoration-line hover:text-ink">
          Already ordered? Track your ticket →
        </Link>
      </div>

      <div className="flex flex-col justify-center bg-ink px-6 py-12 md:px-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-paper/50">Running a stall?</p>
        <h1 className="mt-2 font-display text-4xl leading-none text-paper">Staff &amp; admin access</h1>
        <p className="mt-3 max-w-sm text-paper/60">
          Manage your stall's orders and menu, or set up new stalls for the food court.
        </p>

        <div className="mt-8 max-w-xs space-y-3">
          <Link
            to="/owner/login"
            className="block border-2 border-paprika bg-paprika px-6 py-3.5 text-center font-medium text-white hover:bg-paprika-dark transition-colors"
          >
            Stall owner login
          </Link>
          <Link
            to="/admin/login"
            className="block border-2 border-paper/30 px-6 py-3.5 text-center font-medium text-paper hover:border-paper transition-colors"
          >
            Admin login
          </Link>
        </div>
      </div>
    </div>
  );
}
