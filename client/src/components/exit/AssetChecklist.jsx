import React, { useState } from 'react';
import exitAPI from '../../services/exitAPI';
import toast from 'react-hot-toast';

const AssetChecklist = ({ request, onUpdate }) => {
    // Basic defaults if empty
    const defaultAssets = [
        { item: 'Laptop', returned: false },
        { item: 'ID Card / Access Badge', returned: false },
        { item: 'Company Phone', returned: false },
        { item: 'Keys', returned: false }
    ];

    const [checklist, setChecklist] = useState(
        request.assetChecklist && request.assetChecklist.length > 0 
        ? request.assetChecklist 
        : defaultAssets
    );
    const [loading, setLoading] = useState(false);

    const toggleItem = (index) => {
        const newChecklist = [...checklist];
        newChecklist[index].returned = !newChecklist[index].returned;
        setChecklist(newChecklist);
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const allReturned = checklist.every(c => c.returned);
            // Optionally auto-update stage if all returned, or just save checklist state
            const payload = { assetChecklist: checklist };
            
            // If we're currently in Asset Return stage and all returned
            if (request.stage === 'Asset Return' && allReturned) {
                 payload.stage = 'Exit Completed'; // Move to complete or Interview
            }

            await exitAPI.updateStage(request._id, payload);
            toast.success("Asset checklist updated.");
            if (onUpdate) onUpdate();
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to update assets");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mt-4">
            <h3 className="text-lg font-semibold mb-4">Asset Return Checklist</h3>
            <div className="space-y-3">
                {checklist.map((c, index) => (
                    <label key={index} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={c.returned}
                            onChange={() => toggleItem(index)}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className={`${c.returned ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                            {c.item}
                        </span>
                    </label>
                ))}
            </div>
            
            <div className="mt-6 flex justify-end">
                <button 
                    onClick={handleSave} 
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    Save Assets
                </button>
            </div>
        </div>
    );
};

export default AssetChecklist;
