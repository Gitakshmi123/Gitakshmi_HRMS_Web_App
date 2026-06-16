const mongoose = require('mongoose');
const Automation = mongoose.model('Automation');

exports.getAutomations = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const automations = await Automation.find({ tenantId }).sort({ createdAt: -1 });
    res.json({ success: true, automations });
  } catch (error) {
    console.error('Error fetching automations:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch automations', error: error.message });
  }
};

exports.createAutomation = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const { name, description, triggerEvent, isActive, conditions, actions, visualLayout } = req.body;
    
    const automation = new Automation({
      tenantId,
      name,
      description,
      triggerEvent,
      isActive,
      conditions,
      actions,
      visualLayout,
      createdBy: req.user?._id
    });
    
    await automation.save();
    res.status(201).json({ success: true, automation });
  } catch (error) {
    console.error('Error creating automation:', error);
    res.status(500).json({ success: false, message: 'Failed to create automation', error: error.message });
  }
};

exports.updateAutomation = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const { id } = req.params;
    
    const automation = await Automation.findOneAndUpdate(
      { _id: id, tenantId },
      { ...req.body, updatedBy: req.user?._id },
      { new: true, runValidators: true }
    );
    
    if (!automation) return res.status(404).json({ success: false, message: 'Automation not found' });
    
    res.json({ success: true, automation });
  } catch (error) {
    console.error('Error updating automation:', error);
    res.status(500).json({ success: false, message: 'Failed to update automation', error: error.message });
  }
};

exports.deleteAutomation = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const { id } = req.params;
    
    const automation = await Automation.findOneAndDelete({ _id: id, tenantId });
    if (!automation) return res.status(404).json({ success: false, message: 'Automation not found' });
    
    res.json({ success: true, message: 'Automation deleted successfully' });
  } catch (error) {
    console.error('Error deleting automation:', error);
    res.status(500).json({ success: false, message: 'Failed to delete automation', error: error.message });
  }
};
