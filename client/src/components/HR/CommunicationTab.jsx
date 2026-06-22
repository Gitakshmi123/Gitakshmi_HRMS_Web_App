import React from 'react';
import { Home, MapPin, Phone } from 'lucide-react';
import { TabularContainer, TabularRow, TabularField } from './TabularForm';

/**
 * Tab 3: Communication & Emergency — Primary phone, Address (temp/perm), Emergency contact.
 * Uses existing form state; no logic change.
 */
const CommunicationTab = React.memo(function CommunicationTab({
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
    <div className="space-y-6 animate-in fade-in duration-200">

      {/* Communication Address (primary) */}
      <TabularContainer>
        <div className="bg-slate-100 dark:bg-slate-800/80 p-3 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <Home size={16} className="text-indigo-500" />
          <span>COMMUNICATION ADDRESS</span>
        </div>
        <TabularRow columns={2}>
          <TabularField label="ADDRESS LINE 1" required>
            <input
              value={tempAddress?.line1}
              onChange={(e) => setTempAddress?.((p) => ({ ...p, line1: e.target.value }))}
              className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400 ${errors.tempLine1 ? 'border-b-2 border-rose-400' : ''}`}
              placeholder="Street, Sector, Area"
            />
            {errors.tempLine1 && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.tempLine1}</p>}
          </TabularField>
          <TabularField label="ADDRESS LINE 2">
            <input
              value={tempAddress?.line2}
              onChange={(e) => setTempAddress?.((p) => ({ ...p, line2: e.target.value }))}
              className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400"
              placeholder="Landmark, Building"
            />
          </TabularField>
        </TabularRow>
        <TabularRow columns={4}>
          <TabularField label="CITY" required>
            <input
              value={tempAddress?.city}
              onChange={(e) => setTempAddress?.((p) => ({ ...p, city: e.target.value }))}
              className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400 ${errors.tempCity ? 'border-b-2 border-rose-400' : ''}`}
              placeholder="City"
            />
            {pincodeLoading && tempAddress?.city?.length > 2 && <span className="text-[10px] text-indigo-500 animate-pulse mt-0.5 block">Searching...</span>}
            {errors.tempCity && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.tempCity}</p>}
          </TabularField>
          <TabularField label="STATE">
            <input value={tempAddress?.state} readOnly className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-500 cursor-not-allowed" />
          </TabularField>
        </TabularRow>
        <TabularRow columns={4}>
          <TabularField label="ZIP / PIN CODE" required>
            <input
              value={tempAddress?.pinCode}
              onChange={(e) => setTempAddress?.((p) => ({ ...p, pinCode: e.target.value }))}
              onBlur={() => handlePincodeLookup?.(tempAddress?.pinCode, 'temp')}
              className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400 ${errors.tempPin ? 'border-b-2 border-rose-400' : ''}`}
              placeholder="6-digit code"
            />
            {errors.tempPin && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.tempPin}</p>}
          </TabularField>
          <TabularField label="COUNTRY">
            <input value={tempAddress?.country} readOnly className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-500 cursor-not-allowed" />
          </TabularField>
        </TabularRow>
      </TabularContainer>

      {/* Local Address Toggle */}
      <div className="flex items-center">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={commSameAsTemp}
            onChange={(e) => {
              const checked = e.target.checked;
              setCommSameAsTemp?.(checked);
              if (!checked) setCommAddress?.({ line1: '', line2: '', city: '', state: '', pinCode: '', country: '' });
            }}
            className="w-4 h-4 rounded border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500/20 transition-all cursor-pointer"
          />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Local Address same as Communication</span>
        </label>
      </div>

      {/* Local Address Fields */}
      {!commSameAsTemp && (
        <TabularContainer className="animate-in slide-in-from-top-2 duration-300">
          <div className="bg-slate-100 dark:bg-slate-800/80 p-3 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <MapPin size={16} className="text-indigo-500" />
            <span>LOCAL ADDRESS</span>
          </div>
          <TabularRow columns={2}>
            <TabularField label="ADDRESS LINE 1" required>
              <input
                value={commAddress?.line1}
                onChange={(e) => setCommAddress?.((p) => ({ ...p, line1: e.target.value }))}
                className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400 ${errors.commLine1 ? 'border-b-2 border-rose-400' : ''}`}
                placeholder="Street, Sector, Area"
              />
              {errors.commLine1 && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.commLine1}</p>}
            </TabularField>
            <TabularField label="ADDRESS LINE 2">
              <input
                value={commAddress?.line2}
                onChange={(e) => setCommAddress?.((p) => ({ ...p, line2: e.target.value }))}
                className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400"
                placeholder="Landmark, Building"
              />
            </TabularField>
          </TabularRow>
          <TabularRow columns={4}>
            <TabularField label="CITY" required>
              <input
                value={commAddress?.city}
                onChange={(e) => setCommAddress?.((p) => ({ ...p, city: e.target.value }))}
                className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400 ${errors.commCity ? 'border-b-2 border-rose-400' : ''}`}
                placeholder="City"
              />
              {pincodeLoading && commAddress?.city?.length > 2 && <span className="text-[10px] text-indigo-500 animate-pulse mt-0.5 block">Searching...</span>}
              {errors.commCity && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.commCity}</p>}
            </TabularField>
            <TabularField label="STATE">
              <input value={commAddress?.state} readOnly className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-500 cursor-not-allowed" />
            </TabularField>
          </TabularRow>
          <TabularRow columns={4}>
            <TabularField label="ZIP / PIN CODE" required>
              <input
                value={commAddress?.pinCode}
                onChange={(e) => setCommAddress?.((p) => ({ ...p, pinCode: e.target.value }))}
                onBlur={() => handlePincodeLookup?.(commAddress?.pinCode, 'comm')}
                className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400 ${errors.commPin ? 'border-b-2 border-rose-400' : ''}`}
                placeholder="6-digit code"
              />
              {errors.commPin && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.commPin}</p>}
            </TabularField>
            <TabularField label="COUNTRY">
              <input value={commAddress?.country} readOnly className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-500 cursor-not-allowed" />
            </TabularField>
          </TabularRow>
        </TabularContainer>
      )}

      {/* Permanent Address Toggle */}
      <div className="flex items-center">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={sameAsTemp}
            onChange={(e) => {
              const checked = e.target.checked;
              setSameAsTemp?.(checked);
              if (!checked) setPermAddress?.({ line1: '', line2: '', city: '', state: '', pinCode: '', country: '' });
            }}
            className="w-4 h-4 rounded border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500/20 transition-all cursor-pointer"
          />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Permanent Address same as Local</span>
        </label>
      </div>

      {/* Permanent Address Fields */}
      {!sameAsTemp && (
        <TabularContainer className="animate-in slide-in-from-top-2 duration-300">
          <div className="bg-slate-100 dark:bg-slate-800/80 p-3 text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <MapPin size={16} className="text-indigo-500" />
            <span>PERMANENT ADDRESS</span>
          </div>
          <TabularRow columns={2}>
            <TabularField label="ADDRESS LINE 1" required>
              <input
                value={permAddress?.line1}
                onChange={(e) => setPermAddress?.((p) => ({ ...p, line1: e.target.value }))}
                className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400 ${errors.permLine1 ? 'border-b-2 border-rose-400' : ''}`}
                placeholder="Street, Sector, Area"
              />
              {errors.permLine1 && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.permLine1}</p>}
            </TabularField>
            <TabularField label="ADDRESS LINE 2">
              <input
                value={permAddress?.line2}
                onChange={(e) => setPermAddress?.((p) => ({ ...p, line2: e.target.value }))}
                className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400"
                placeholder="Landmark, Building"
              />
            </TabularField>
          </TabularRow>
          <TabularRow columns={4}>
            <TabularField label="CITY" required>
              <input
                value={permAddress?.city}
                onChange={(e) => setPermAddress?.((p) => ({ ...p, city: e.target.value }))}
                className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400 ${errors.permCity ? 'border-b-2 border-rose-400' : ''}`}
                placeholder="City"
              />
              {pincodeLoading && permAddress?.city?.length > 2 && <span className="text-[10px] text-indigo-500 animate-pulse mt-0.5 block">Searching...</span>}
              {errors.permCity && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.permCity}</p>}
            </TabularField>
            <TabularField label="STATE">
              <input value={permAddress?.state} readOnly className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-500 cursor-not-allowed" />
            </TabularField>
          </TabularRow>
          <TabularRow columns={4}>
            <TabularField label="ZIP / PIN CODE" required>
              <input
                value={permAddress?.pinCode}
                onChange={(e) => setPermAddress?.((p) => ({ ...p, pinCode: e.target.value }))}
                onBlur={() => handlePincodeLookup?.(permAddress?.pinCode, 'perm')}
                className={`w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium placeholder:text-slate-400 ${errors.permPin ? 'border-b-2 border-rose-400' : ''}`}
                placeholder="6-digit code"
              />
              {errors.permPin && <p className="text-[10px] font-medium text-rose-500 mt-1">{errors.permPin}</p>}
            </TabularField>
            <TabularField label="COUNTRY">
              <input value={permAddress?.country} readOnly className="w-full h-[38px] px-3 bg-transparent outline-none text-sm font-medium text-slate-500 cursor-not-allowed" />
            </TabularField>
          </TabularRow>
        </TabularContainer>
      )}

    </div>
  );
});

export default CommunicationTab;
