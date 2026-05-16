import faqModel from "../models/faq.js";

const addfaq = async (req, res) => {

    try {
        const { question, answer } = req.body;
        const faq = new faqModel({ question, answer });
        await faq.save();
        res.status(201).json({ success: true, message: "New FAQ Added", faq });
    } catch (err) {
        console.error(err.message);
        console.log("Add FAQ failed");
        res.status(500).json({ success: false, message: "Failed to add FAQ" });
    }
};

const getAllFaqs = async (req, res) => {
    try {
        const allFaqs = await faqModel.find().sort({ createdAt: -1 });
        res.status(201).json({ success: true, message: "All FAQs", allFaqs });
    } catch (err) {
        console.error(err.message);
        console.log("Get all FAQs failed");
        res.status(500).json({ success: false, message: "Failed to get FAQs" });
    }
};

const updateFaq = async (req, res) => {
    try {
        const { id, question, answer } = req.body;

        const updatedFaq = await faqModel.findByIdAndUpdate(
            id,
            { question, answer },
            { new: true }
        );
        if (!updatedFaq) {
            return res.status(404).json({ success: false, message: "FAQ not found" });
        }
        res.status(200).json({ success: true, message: "FAQ Updated", updatedFaq });
    } catch (err) {
        console.error(err.message);
        console.log("Update FAQ failed");
        res.status(500).json({ success: false, message: "Failed to update FAQ" });
    }
};

const deleteFaq = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedFaq = await faqModel.findByIdAndDelete(id);
        if (!deletedFaq) {
            return res.status(404).json({ success: false, message: "FAQ not found" });
        }
        res.status(200).json({ success: true, message: "FAQ Deleted", deletedFaq });
    }
    catch (err) {
        console.error(err.message);
        console.log("Delete FAQ failed");
        res.status(500).json({ success: false, message: "Failed to delete FAQ" });
    }
};

export { addfaq, getAllFaqs, updateFaq, deleteFaq };