import React from 'react';
import { Home, MapPin, Phone } from 'lucide-react';

/**
 * Tab 3: Communication & Emergency — Primary phone, Address (temp/perm), Emergency contact.
 * Uses existing form state; no logic change.
 */
export default function CommunicationTab({
  contactNo,
  setContactNo,
  emergencyContactName,
  setEmergencyContactName,
  emergencyContactNumber,
  setEmergencyContactNumber,
  tempAddress,
  setTempAddress,
  permAddress,
  setPermAddress,
  commAddress,
  setCommAddress,
  sameAsTemp,
  setSameAsTemp,
  commSameAsTemp,
  setCommSameAsTemp,
  errors = {},
  pincodeLoading,
  handlePincodeLookup,
  handleCityLookup,
}) {
  return (
    <div className="space-y-3 animate-in fade-in duration-200">

      {/* Communication Address (primary) */}
      <div className="pt-1">
        <div className="flex items-center gap-3 mb-3">
          <Home size={20} className="text-indigo-500" />
          <h3 className="text-base font-bold text-slate-800 dark:text-white">Communication Address</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5 md:col-span-1 lg:col-span-2">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">Address Line 1 <span className="text-rose-500 ml-1 mt-0.5">*</span></label>
            <input
              value={tempAddress?.line1}
              onChange={(e) => setTempAddress?.((p) => ({ ...p, line1: e.target.value }))}
              className={`w-full h-[42px] px-4 bg-slate-50/50 dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium ${errors.tempLine1 ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
              placeholder="Street, Sector, Area"
            />
            {errors.tempLine1 && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.tempLine1}</p>}
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-1 lg:col-span-2">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">Address Line 2</label>
            <input
              value={tempAddress?.line2}
              onChange={(e) => setTempAddress?.((p) => ({ ...p, line2: e.target.value }))}
              className="w-full h-[42px] px-4 bg-slate-50/50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-sm font-medium text-slate-700"
              placeholder="Landmark, Building"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">City <span className="text-rose-500 ml-1 mt-0.5">*</span></label>
            <input
              value={tempAddress?.city}
              onChange={(e) => setTempAddress?.((p) => ({ ...p, city: e.target.value }))}
              className={`w-full h-[42px] px-4 bg-slate-50/50 dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium ${errors.tempCity ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
              placeholder="City"
            />
            {pincodeLoading && tempAddress?.city?.length > 2 && <span className="text-[10px] text-indigo-500 animate-pulse mt-0.5">Searching...</span>}
            {errors.tempCity && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.tempCity}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">State</label>
            <input value={tempAddress?.state} readOnly className="w-full h-[42px] px-4 bg-slate-100 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-500 cursor-not-allowed" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">Zip / Pin Code <span className="text-rose-500 ml-1 mt-0.5">*</span></label>
            <input
              value={tempAddress?.pinCode}
              onChange={(e) => setTempAddress?.((p) => ({ ...p, pinCode: e.target.value }))}
              onBlur={() => handlePincodeLookup?.(tempAddress?.pinCode, 'temp')}
              className={`w-full h-[42px] px-4 bg-slate-50/50 dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium ${errors.tempPin ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
              placeholder="6-digit code"
            />
            {errors.tempPin && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.tempPin}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">Country</label>
            <input value={tempAddress?.country} readOnly className="w-full h-[42px] px-4 bg-slate-100 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-500 cursor-not-allowed" />
          </div>
        </div>
      </div>

      {/* Address Toggles Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Permanent Address Toggle */}
        <label className="flex items-center gap-3 p-4 bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800/60 cursor-pointer hover:bg-slate-50/30 transition-colors group">
          <input
            type="checkbox"
            checked={sameAsTemp}
            onChange={(e) => {
              const checked = e.target.checked;
              setSameAsTemp?.(checked);
              if (!checked) setPermAddress?.({ line1: '', line2: '', city: '', state: '', pinCode: '', country: '' });
            }}
            className="w-5 h-5 rounded-lg border-2 border-slate-200 text-slate-600 focus:ring-indigo-500/20 transition-all cursor-pointer"
          />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">Permanent Address same as Communication</span>
        </label>

        {/* Communication Address Toggle */}
        <label className="flex items-center gap-3 p-4 bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800/60 cursor-pointer hover:bg-slate-50/30 transition-colors group">
          <input
            type="checkbox"
            checked={commSameAsTemp}
            onChange={(e) => {
              const checked = e.target.checked;
              setCommSameAsTemp?.(checked);
              if (!checked) setCommAddress?.({ line1: '', line2: '', city: '', state: '', pinCode: '', country: '' });
            }}
            className="w-5 h-5 rounded-lg border-2 border-slate-200 text-slate-600 focus:ring-indigo-500/20 transition-all cursor-pointer"
          />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">Local Address same as Communication</span>
        </label>
      </div>

      {/* Permanent Address Fields */}
      {!sameAsTemp && (
        <div className="pt-2 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3 mb-4">
            <MapPin size={20} className="text-indigo-500" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white uppercase tracking-tight">Permanent Address</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5 md:col-span-1 lg:col-span-2">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">Address Line 1 <span className="text-rose-500 ml-1 mt-0.5">*</span></label>
              <input
                value={permAddress?.line1}
                onChange={(e) => setPermAddress?.((p) => ({ ...p, line1: e.target.value }))}
                className={`w-full h-[42px] px-4 bg-slate-50/50 dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium ${errors.permLine1 ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
                placeholder="Street, Sector, Area"
              />
              {errors.permLine1 && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.permLine1}</p>}
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-1 lg:col-span-2">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">Address Line 2</label>
              <input
                value={permAddress?.line2}
                onChange={(e) => setPermAddress?.((p) => ({ ...p, line2: e.target.value }))}
                className="w-full h-[42px] px-4 bg-slate-50/50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-sm font-medium text-slate-700"
                placeholder="Landmark, Building"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">City <span className="text-rose-500 ml-1 mt-0.5">*</span></label>
              <input
                value={permAddress?.city}
                onChange={(e) => setPermAddress?.((p) => ({ ...p, city: e.target.value }))}
                className={`w-full h-[42px] px-4 bg-slate-50/50 dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium ${errors.permCity ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
                placeholder="City"
              />
              {pincodeLoading && permAddress?.city?.length > 2 && <span className="text-[10px] text-indigo-500 animate-pulse mt-0.5">Searching...</span>}
              {errors.permCity && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.permCity}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">State</label>
              <input value={permAddress?.state} readOnly className="w-full h-[42px] px-4 bg-slate-100 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-500 cursor-not-allowed" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">Zip / Pin Code <span className="text-rose-500 ml-1 mt-0.5">*</span></label>
              <input
                value={permAddress?.pinCode}
                onChange={(e) => setPermAddress?.((p) => ({ ...p, pinCode: e.target.value }))}
                onBlur={() => handlePincodeLookup?.(permAddress?.pinCode, 'perm')}
                className={`w-full h-[42px] px-4 bg-slate-50/50 dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium ${errors.permPin ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
                placeholder="6-digit code"
              />
              {errors.permPin && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.permPin}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">Country</label>
              <input value={permAddress?.country} readOnly className="w-full h-[42px] px-4 bg-slate-100 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-500 cursor-not-allowed" />
            </div>
          </div>
        </div>
      )}

      {/* Local Address Fields */}
      {!commSameAsTemp && (
          <div className="pt-2 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3 mb-4">
            <MapPin size={20} className="text-indigo-500" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white uppercase tracking-tight">Local Address</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5 md:col-span-1 lg:col-span-2">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">Address Line 1 <span className="text-rose-500 ml-1 mt-0.5">*</span></label>
              <input
                value={commAddress?.line1}
                onChange={(e) => setCommAddress?.((p) => ({ ...p, line1: e.target.value }))}
                className={`w-full h-[42px] px-4 bg-slate-50/50 dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium ${errors.commLine1 ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
                placeholder="Street, Sector, Area"
              />
              {errors.commLine1 && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.commLine1}</p>}
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-1 lg:col-span-2">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">Address Line 2</label>
              <input
                value={commAddress?.line2}
                onChange={(e) => setCommAddress?.((p) => ({ ...p, line2: e.target.value }))}
                className="w-full h-[42px] px-4 bg-slate-50/50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 text-sm font-medium text-slate-700"
                placeholder="Landmark, Building"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">City <span className="text-rose-500 ml-1 mt-0.5">*</span></label>
              <input
                value={commAddress?.city}
                onChange={(e) => setCommAddress?.((p) => ({ ...p, city: e.target.value }))}
                className={`w-full h-[42px] px-4 bg-slate-50/50 dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium ${errors.commCity ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
                placeholder="City"
              />
              {pincodeLoading && commAddress?.city?.length > 2 && <span className="text-[10px] text-indigo-500 animate-pulse mt-0.5">Searching...</span>}
              {errors.commCity && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.commCity}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">State</label>
              <input value={commAddress?.state} readOnly className="w-full h-[42px] px-4 bg-slate-100 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-500 cursor-not-allowed" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">Zip / Pin Code <span className="text-rose-500 ml-1 mt-0.5">*</span></label>
              <input
                value={commAddress?.pinCode}
                onChange={(e) => setCommAddress?.((p) => ({ ...p, pinCode: e.target.value }))}
                onBlur={() => handlePincodeLookup?.(commAddress?.pinCode, 'comm')}
                className={`w-full h-[42px] px-4 bg-slate-50/50 dark:bg-slate-900/50 border-2 rounded-xl outline-none text-sm font-medium ${errors.commPin ? 'border-rose-200 focus:border-rose-500' : 'border-slate-100 dark:border-slate-800 focus:border-slate-400'}`}
                placeholder="6-digit code"
              />
              {errors.commPin && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.commPin}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide h-4 flex items-center">Country</label>
              <input value={commAddress?.country} readOnly className="w-full h-[42px] px-4 bg-slate-100 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-500 cursor-not-allowed" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
