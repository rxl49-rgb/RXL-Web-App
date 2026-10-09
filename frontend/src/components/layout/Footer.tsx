import { Link } from 'react-router-dom';
import { Phone, MapPin, Facebook, Twitter, Instagram } from 'lucide-react';
import MailIcon from '../icons/MailIcon';

export default function Footer() {
  return (
    <footer className="bg-black text-white/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src="/logo.png" alt="RXL Logistics" className="w-9 h-9 object-contain" />
              <span className="text-white font-bold text-lg">RXL Logistics</span>
            </div>
            <p className="text-sm leading-relaxed mb-5">
              Your trusted global freight forwarding partner. Air, sea, and ground shipping with real-time tracking.
            </p>
            <div className="flex gap-3">
              {[Facebook, Twitter, Instagram].map((Icon, i) => (
                <a key={i} href="#" className="w-8 h-8 rounded-full bg-brand-800 hover:bg-brand-700 flex items-center justify-center transition-colors">
                  <Icon className="w-4 h-4 text-white" />
                </a>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-white font-semibold mb-4">Services</h3>
            <ul className="space-y-2 text-sm">
              {[['Air Freight', '/quote'], ['Sea Freight', '/quote'], ['Ground Shipping', '/quote'], ['Customs Clearance', '/quote'], ['Package Tracking', '/shipment']].map(([label, to]) => (
                <li key={label}><Link to={to} className="hover:text-accent-400 transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              {[['Store', '/store'], ['Get a Quote', '/quote'], ['Track Shipment', '/shipment'], ['Sign Up', '/register'], ['Sign In', '/login']].map(([label, to]) => (
                <li key={label}><Link to={to} className="hover:text-accent-400 transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">Contact</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2"><Phone className="w-4 h-4 text-accent-400 mt-0.5 flex-shrink-0" /><span>+1-800-RXL-SHIP</span></li>
              <li className="flex items-start gap-2"><MailIcon className="w-4 h-4 text-accent-400 mt-0.5 flex-shrink-0" /><span>info@rxllogistics.com</span></li>
              <li className="flex items-start gap-2"><MapPin className="w-4 h-4 text-accent-400 mt-0.5 flex-shrink-0" /><span>Miami, FL 33101, USA</span></li>
            </ul>
            <div className="mt-4 bg-brand-800 rounded-lg p-3 text-xs">
              <p className="text-white font-medium mb-1">Business Hours</p>
              <p>Mon – Fri: 8:00 AM – 6:00 PM</p>
              <p>Sat: 10:00 AM – 2:00 PM</p>
              <p>Sun: Closed</p>
            </div>
          </div>
        </div>

        <div className="border-t border-brand-800 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
          <p>© {new Date().getFullYear()} RXL Logistics. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-accent-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-accent-400 transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
