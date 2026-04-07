import React from 'react';
import { ExecutionPlanDashboardV2 } from '@/components/ExecutionPlanDashboardV2';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Share2 } from 'lucide-react';

// Sample execution plan data - Replace with actual data from API
const sampleExecutionPlan = {
  overview: {
    objective: "Build and validate a comprehensive financial forecast model for Changepreneur ship business, including data collection, template configuration, model generation, stakeholder review, and final delivery with documentation",
    inputs: [
      "Existing financial data and documents",
      "Changepreneur ship business model assumptions",
      "Trello APTLSS template",
      "Historical revenue, expenses, and growth data",
      "Ambidian Biases and Noodzakelijk Online stakeholder input"
    ],
    outputs: [
      "Complete financial forecast model in Trello APTLSS",
      "Detailed forecast documentation and assumptions",
      "Summary report highlighting key financial insights",
      "Stakeholder-approved forecast with sign-off",
      "Updated Trello checklist reflecting completion"
    ]
  },
  steps: [
    {
      id: "step-1",
      title: "Review and Audit Existing Financial Data",
      description: "Conduct comprehensive review of all existing financial documents, statements, and assumptions relevant to Changepreneur ship business. Identify gaps, inconsistencies, or outdated information that may impact forecast accuracy.",
      dependencies: [],
      parallelizable: false,
      timeEstimate: { min: 45, max: 90 },
      risks: [
        "Missing or incomplete financial records",
        "Unclear or conflicting data sources",
        "Outdated assumptions not reflecting current business state",
        "Data in different formats requiring standardization"
      ]
    },
    {
      id: "step-2",
      title: "Conduct Quick Audit for Data Gaps and Inconsistencies",
      description: "Perform focused audit to identify any calculated or broken links within existing documents or unavailable resources. Document what data is missing and determine if it can be obtained or if assumptions must be made.",
      dependencies: ["step-1"],
      parallelizable: false,
      timeEstimate: { min: 30, max: 60 },
      risks: [
        "Broken spreadsheet formulas or links",
        "Inaccessible data sources or stakeholders",
        "Ambiguous data definitions requiring clarification",
        "Time-sensitive data that may have changed"
      ]
    },
    {
      id: "step-3",
      title: "Access and Configure Trello APTLSS Template",
      description: "Log into Trello APTLSS.com and select or customize the financial forecast template suited for Changepreneur ship's business model. Configure template structure to match business requirements.",
      dependencies: ["step-2"],
      parallelizable: false,
      timeEstimate: { min: 20, max: 45 },
      risks: [
        "Template access issues or permission problems",
        "Template not fully aligned with business model",
        "Customization options limited or unclear",
        "Learning curve with new platform"
      ]
    },
    {
      id: "step-4",
      title: "Assemble Required Financial Inputs",
      description: "Compile all necessary financial inputs including historical revenues, expense breakdowns, planned investments, and growth assumptions. Organize data in structured format ready for model input. Can run in parallel with step-3.",
      dependencies: ["step-2"],
      parallelizable: true,
      timeEstimate: { min: 40, max: 80 },
      risks: [
        "Missing historical data for key expense categories",
        "Assumptions not clearly documented or justified",
        "Data inconsistencies across different sources",
        "Stakeholder disagreement on assumptions"
      ]
    },
    {
      id: "step-5",
      title: "Reach Out to Stakeholders for Data Clarification",
      description: "Contact Ambidian Biases and Noodzakelijk Online to clarify any ambiguous data points or missing assumptions. Document all responses and confirmations. Can run in parallel with step-3.",
      dependencies: ["step-2", "step-4"],
      parallelizable: true,
      timeEstimate: { min: 30, max: 120 },
      risks: [
        "Slow stakeholder response times (may add 1-3 days)",
        "Conflicting information from different stakeholders",
        "Stakeholders unavailable or unresponsive",
        "Ambiguous or incomplete responses requiring follow-up"
      ]
    },
    {
      id: "step-6",
      title: "Input Verified Financial Data into Trello APTLSS",
      description: "Enter all verified financial data into the Trello APTLSS forecasting module. Ensure accuracy and consistency of all inputs. Cross-reference with source documents. May require rework if data entry errors are discovered during validation.",
      dependencies: ["step-3", "step-4", "step-5"],
      parallelizable: false,
      timeEstimate: { min: 60, max: 120 },
      risks: [
        "Data entry errors or typos requiring correction",
        "Incorrect formula references causing calculation errors",
        "Unit mismatches (e.g., thousands vs. actual amounts)",
        "Platform limitations on data format or size"
      ]
    },
    {
      id: "step-7",
      title: "Define and Configure Critical Forecast Variables",
      description: "Configure critical forecast variables such as sales growth rates, overhead costs, capital expenditures, and key assumptions within the Trello APTLSS platform. Document rationale for each variable. Requires validation in step-10.",
      dependencies: ["step-6"],
      parallelizable: false,
      timeEstimate: { min: 45, max: 90 },
      risks: [
        "Unclear variable definitions or relationships",
        "Assumptions not supported by historical data",
        "Variables not sensitive to business drivers",
        "Configuration complexity exceeding user expertise"
      ]
    },
    {
      id: "step-8",
      title: "Set Forecast Period Parameters",
      description: "Configure forecast period parameters (monthly for first year, quarterly thereafter) aligned with project reporting needs and business planning cycles.",
      dependencies: ["step-7"],
      parallelizable: false,
      timeEstimate: { min: 15, max: 30 },
      risks: [
        "Misalignment with stakeholder reporting requirements",
        "Platform limitations on period configuration",
        "Confusion over fiscal vs. calendar year alignment"
      ]
    },
    {
      id: "step-9",
      title: "Generate Initial Forecast Model",
      description: "Run the forecast model generation in Trello APTLSS. Review output for logical consistency and plausible financial trends. Document any warnings or anomalies. If generation fails, may require returning to step-6 to correct data.",
      dependencies: ["step-8"],
      parallelizable: false,
      timeEstimate: { min: 20, max: 45 },
      risks: [
        "Model generation errors or failures requiring data correction",
        "Unrealistic or illogical forecast outputs",
        "System timeout or performance issues",
        "Incomplete or corrupted output data"
      ]
    },
    {
      id: "step-10",
      title: "Conduct Detailed Model Review and Validation",
      description: "Perform detailed review of the generated forecast model for logical consistency and plausible financial trends. Validate key outputs against historical patterns and business logic. If issues found, loop back to step-7 or step-14 for adjustments.",
      dependencies: ["step-9"],
      parallelizable: false,
      timeEstimate: { min: 60, max: 120 },
      risks: [
        "Forecast outputs inconsistent with business reality",
        "Unrealistic growth or decline projections requiring rework",
        "Missing or incorrect calculations",
        "Assumptions not properly reflected in outputs"
      ]
    },
    {
      id: "step-11",
      title: "Document All Assumptions and Data Sources",
      description: "Create comprehensive documentation of all assumptions, variable definitions, and data sources used in the forecast. Include supporting rationale and links to source documents. Must be completed before stakeholder review.",
      dependencies: ["step-10"],
      parallelizable: false,
      timeEstimate: { min: 45, max: 90 },
      risks: [
        "Incomplete documentation of complex assumptions",
        "Missing source document references",
        "Unclear rationale for key assumptions",
        "Documentation not aligned with actual model configuration"
      ]
    },
    {
      id: "step-12",
      title: "Share Draft Forecast with Stakeholders",
      description: "Share the draft forecast model and documentation with Ambidian Biases and Noodzakelijk Online for initial review and feedback. Request specific comments on assumptions and outputs. Expect 2-5 day response time.",
      dependencies: ["step-11"],
      parallelizable: false,
      timeEstimate: { min: 15, max: 30 },
      risks: [
        "Stakeholders unavailable for timely review (may delay 2-7 days)",
        "Feedback unclear or contradictory requiring clarification",
        "Stakeholders request major model changes",
        "Communication delays or misunderstandings"
      ]
    },
    {
      id: "step-13",
      title: "Collect and Organize Stakeholder Feedback",
      description: "Gather all feedback from stakeholders. Organize by category (data adjustments, assumption changes, output concerns, documentation gaps). Prioritize feedback by impact and feasibility. May require follow-up with stakeholders for clarification.",
      dependencies: ["step-12"],
      parallelizable: false,
      timeEstimate: { min: 20, max: 45 },
      risks: [
        "Conflicting feedback from different stakeholders",
        "Feedback requiring significant model rework (20+ hours)",
        "Incomplete or vague feedback requiring clarification calls",
        "Feedback received in multiple formats or channels"
      ]
    },
    {
      id: "step-14",
      title: "Apply Adjustments to Forecast Model",
      description: "Implement all approved adjustments to the forecast model based on stakeholder feedback. Update assumptions, recalculate outputs, and document all changes made. If major changes required, loop back to step-7 for reconfiguration.",
      dependencies: ["step-13"],
      parallelizable: false,
      timeEstimate: { min: 45, max: 120 },
      risks: [
        "Adjustments introducing new errors or inconsistencies",
        "Changes requiring cascade updates to dependent calculations",
        "Difficulty reverting changes if adjustments prove problematic",
        "Time-consuming manual updates if platform lacks automation"
      ]
    },
    {
      id: "step-15",
      title: "Re-run Forecast Validation",
      description: "Re-run the forecast model with updated assumptions and data. Validate that all updates are correctly reflected in outputs and that model still produces logical results. If validation fails, return to step-14 for additional adjustments.",
      dependencies: ["step-14"],
      parallelizable: false,
      timeEstimate: { min: 30, max: 60 },
      risks: [
        "Model errors introduced by adjustments",
        "Outputs still not meeting stakeholder expectations",
        "Validation revealing need for additional changes (iteration loop)",
        "Platform issues preventing successful re-run"
      ]
    },
    {
      id: "step-16",
      title: "Prepare Concise Summary Report",
      description: "Create a concise summary report or presentation highlighting key financial insights, risks, and opportunities for Changepreneur ship. Include executive summary, key metrics, and strategic implications.",
      dependencies: ["step-15"],
      parallelizable: false,
      timeEstimate: { min: 45, max: 90 },
      risks: [
        "Summary too technical or not accessible to stakeholders",
        "Key insights not clearly communicated",
        "Report length or format not matching stakeholder preferences",
        "Missing critical financial metrics or insights"
      ]
    },
    {
      id: "step-17",
      title: "Upload Final Forecast Files and Documentation",
      description: "Upload the final forecast model, supporting documentation, and summary report to the Trello card. Ensure all files are properly organized, labeled, and accessible to stakeholders.",
      dependencies: ["step-16"],
      parallelizable: false,
      timeEstimate: { min: 20, max: 40 },
      risks: [
        "File upload errors or platform limitations",
        "Files not properly organized or labeled",
        "Stakeholders unable to access or download files",
        "Version control issues with multiple file versions"
      ]
    },
    {
      id: "step-18",
      title: "Update Trello Checklist and Notify Stakeholders",
      description: "Update the Trello checklist to reflect completion of all tasks. Notify Ambidian Biases and Noodzakelijk Online via Trello comment or direct message that forecast is complete and ready for review.",
      dependencies: ["step-17"],
      parallelizable: false,
      timeEstimate: { min: 10, max: 20 },
      risks: [
        "Notification not reaching stakeholders",
        "Stakeholders missing the completion notification",
        "Trello checklist not accurately reflecting status"
      ]
    },
    {
      id: "step-19",
      title: "Schedule Follow-up Meeting with Stakeholders",
      description: "If required, schedule and facilitate a short meeting or call with Ambidian Biases and Noodzakelijk Online to discuss the forecast, address questions, and discuss next strategic steps.",
      dependencies: ["step-18"],
      parallelizable: false,
      timeEstimate: { min: 30, max: 90 },
      risks: [
        "Difficulty scheduling meeting with multiple stakeholders (may add 2-5 days)",
        "Meeting revealing need for significant model changes",
        "Stakeholders requesting additional analysis or scenarios",
        "Technical issues during meeting (e.g., screen sharing problems)"
      ]
    }
  ],
  iterationFlows: [
    {
      loopName: "Data Validation and Correction Loop",
      steps: ["step-2", "step-4", "step-5", "step-6"]
    },
    {
      loopName: "Model Review and Adjustment Loop",
      steps: ["step-10", "step-12", "step-13", "step-14", "step-15"]
    },
    {
      loopName: "Stakeholder Feedback and Rework Cycle",
      steps: ["step-12", "step-13", "step-14", "step-15", "step-16"]
    }
  ],
  totalEstimate: { min: 645, max: 1380 }
};

export default function ExecutionPlanPage() {
  const [completedSteps, setCompletedSteps] = React.useState<string[]>([]);
  const [inProgressStep, setInProgressStep] = React.useState<string | undefined>();

  const handleExport = () => {
    const dataStr = JSON.stringify(sampleExecutionPlan, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'execution-plan.json';
    link.click();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Financial Forecast Execution Plan</h1>
            <p className="text-gray-600 mt-2">Changepreneur Ship Business Model</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* Main Dashboard */}
        <ExecutionPlanDashboardV2
          plan={sampleExecutionPlan}
        />
      </div>
    </div>
  );
}
