'use client';

import React from 'react';
import { CSVError, CSVWarning } from '@/types/distribution';
import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CSVErrorDisplayProps {
  errors: CSVError[];
  warnings: CSVWarning[];
  onDismiss: () => void;
}

export function CSVErrorDisplay({ errors, warnings, onDismiss }: CSVErrorDisplayProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  if (!hasErrors && !hasWarnings) {
    return null;
  }

  const totalIssues = errors.length + warnings.length;
  const displayLimit = 10;
  const hasMore = totalIssues > displayLimit;

  return (
    <div className={`rounded-lg border ${
      hasErrors 
        ? 'bg-red-900/20 border-red-700' 
        : 'bg-yellow-900/20 border-yellow-700'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {hasErrors ? (
            <AlertCircle className="h-5 w-5 text-red-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          )}
          <div>
            <h3 className={`font-semibold ${
              hasErrors ? 'text-red-300' : 'text-yellow-300'
            }`}>
              CSV {hasErrors ? 'Processing Failed' : 'Processing Warnings'}
            </h3>
            <p className={`text-sm ${
              hasErrors ? 'text-red-400' : 'text-yellow-400'
            }`}>
              {hasErrors && `${errors.length} error${errors.length !== 1 ? 's' : ''}`}
              {hasErrors && hasWarnings && ' and '}
              {hasWarnings && `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`}
              {' '}found
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className={hasErrors ? 'text-red-300 hover:text-red-200' : 'text-yellow-300 hover:text-yellow-200'}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show Details
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            className={`h-8 w-8 ${
              hasErrors 
                ? 'text-red-300 hover:text-red-200 hover:bg-red-900/30' 
                : 'text-yellow-300 hover:text-yellow-200 hover:bg-yellow-900/30'
            }`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Error/Warning List */}
      {isExpanded && (
        <div className="border-t border-current/20 p-4 pt-3">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {/* Errors */}
            {errors.slice(0, displayLimit).map((error, index) => (
              <div
                key={`error-${index}`}
                className="flex gap-3 text-sm bg-red-950/30 rounded p-3 border border-red-800/30"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    {error.line > 0 && (
                      <span className="text-red-300 font-mono text-xs font-semibold">
                        Line {error.line}
                      </span>
                    )}
                    {error.column && (
                      <span className="text-red-400 text-xs">
                        ({error.column})
                      </span>
                    )}
                  </div>
                  <p className="text-red-200">{error.message}</p>
                  {error.value && (
                    <code className="block mt-1 text-xs text-red-300 bg-red-950/50 px-2 py-1 rounded overflow-x-auto">
                      {error.value}
                    </code>
                  )}
                </div>
              </div>
            ))}

            {/* Warnings */}
            {warnings.slice(0, displayLimit - errors.length).map((warning, index) => (
              <div
                key={`warning-${index}`}
                className="flex gap-3 text-sm bg-yellow-950/30 rounded p-3 border border-yellow-800/30"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    {warning.line > 0 && (
                      <span className="text-yellow-300 font-mono text-xs font-semibold">
                        Line {warning.line}
                      </span>
                    )}
                  </div>
                  <p className="text-yellow-200">{warning.message}</p>
                  {warning.value && (
                    <code className="block mt-1 text-xs text-yellow-300 bg-yellow-950/50 px-2 py-1 rounded overflow-x-auto">
                      {warning.value}
                    </code>
                  )}
                </div>
              </div>
            ))}

            {/* Show more indicator */}
            {hasMore && (
              <div className="text-center pt-2">
                <p className={`text-sm ${
                  hasErrors ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  ... and {totalIssues - displayLimit} more issue{totalIssues - displayLimit !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>

          {/* Help text */}
          <div className={`mt-4 pt-3 border-t border-current/20 text-sm ${
            hasErrors ? 'text-red-300' : 'text-yellow-300'
          }`}>
            <p className="font-medium mb-2">How to fix:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Check that all addresses are valid Stellar addresses (start with G)</li>
              <li>Ensure amounts are valid numbers (for weighted distribution)</li>
              <li>Verify CSV format matches the template</li>
              <li>Remove any duplicate addresses</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
