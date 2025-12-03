"use client";

import React from "react";

interface StepIndicatorProps {
  currentStep: number;
  steps: string[];
}

export default function StepIndicator({
  currentStep,
  steps,
}: StepIndicatorProps) {
  return (
    <div className="w-full max-w-3xl mx-auto mb-12 px-4">
      {/* Circles and Lines Row */}
      <div className="flex items-center justify-between mb-3">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          return (
            <React.Fragment key={index}>
              {/* Step Circle */}
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${
                  isCompleted
                    ? "bg-ing-orange text-white"
                    : isActive
                    ? "bg-ing-orange text-white shadow-lg scale-110"
                    : "bg-gray-200 text-gray-400 border-2 border-gray-300"
                }`}
              >
                {isCompleted ? "✓" : stepNumber}
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-2 transition-all duration-300 ${
                    isCompleted ? "bg-ing-orange" : "bg-gray-300"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Labels Row */}
      <div className="flex items-start justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          return (
            <div
              key={index}
              className="flex-1 flex justify-center"
              style={{ maxWidth: index < steps.length - 1 ? 'calc(100% / 4 + 24px)' : 'calc(100% / 4)' }}
            >
              <p
                className={`text-sm font-semibold text-center transition-all ${
                  isActive
                    ? "text-ing-orange scale-105"
                    : isCompleted
                    ? "text-ing-dark"
                    : "text-gray-400"
                }`}
              >
                {step}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
