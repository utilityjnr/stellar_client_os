"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { AlertTriangle, Info, AlertCircle } from "lucide-react";

const ComingSoon = () => {
    return (
        <div className="flex flex-col items-center justify-center h-full">
            <h2 className="text-2xl font-medium mb-2">Coming Soon!</h2>
            <p className="text-gray-400 text-center">
                This feature is currently under development. Please check back later. 😎
            </p>
        </div>
    );
};

export interface InfoMessage {
    type: "info" | "warning" | "error";
    title?: string;
    message: string;
    showOnNetwork?: "mainnet" | "testnet" | "both";
}

const InlineInfoMessage = ({
    infoMessage,
    currentNetwork,
}: {
    infoMessage: InfoMessage;
    currentNetwork: string;
}) => {
    if (infoMessage.showOnNetwork && infoMessage.showOnNetwork !== "both") {
        if (infoMessage.showOnNetwork !== currentNetwork) return null;
    }

    const getIconAndStyles = () => {
        switch (infoMessage.type) {
            case "warning":
                return {
                    icon: <AlertTriangle className="w-4 h-4" />,
                    textColor: "text-yellow-400",
                    iconColor: "text-yellow-500",
                };
            case "error":
                return {
                    icon: <AlertCircle className="w-4 h-4" />,
                    textColor: "text-red-400",
                    iconColor: "text-red-500",
                };
            case "info":
            default:
                return {
                    icon: <Info className="w-4 h-4" />,
                    textColor: "text-blue-400",
                    iconColor: "text-blue-500",
                };
        }
    };

    const styles = getIconAndStyles();

    return (
        <div className="flex items-center gap-2 ml-auto md:ml-auto">
            <div className={styles.iconColor}>{styles.icon}</div>
            <span className={cn("text-sm", styles.textColor)}>
                {infoMessage.title && (
                    <span className="font-semibold">{infoMessage.title}: </span>
                )}
                {infoMessage.message}
            </span>
        </div>
    );
};

const DashboardLayout = ({
    title,
    children,
    className,
    availableNetwork = ["testnet", "mainnet"],
    infoMessage,
}: {
    title: string;
    children?: ReactNode;
    className?: string;
    availableNetwork?: string[];
    infoMessage?: InfoMessage;
}) => {
    // For Stellar, we'll use testnet as default - can be enhanced with wallet provider context
    const currentNetwork = "testnet";
    const isAvailableOnCurrentNetwork = availableNetwork.includes(currentNetwork);

    return (
        <div className="flex flex-col bg-zinc-900 text-white text-base p-4 md:pt-6 md:pb-0 rounded-2xl h-full overflow-hidden">
            <div className="border-b border-b-zinc-700 pb-4 w-full flex-none">
                {/* Desktop: Title and info message on same line */}
                <div className="hidden md:flex items-center">
                    <h1 className="font-medium text-xl">{title}</h1>
                    {infoMessage && isAvailableOnCurrentNetwork && (
                        <InlineInfoMessage
                            infoMessage={infoMessage}
                            currentNetwork={currentNetwork}
                        />
                    )}
                </div>

                {/* Mobile: Title and info message stacked */}
                <div className="md:hidden">
                    <h1 className="font-medium text-xl">{title}</h1>
                    {infoMessage && isAvailableOnCurrentNetwork && (
                        <div className="mt-2">
                            <InlineInfoMessage
                                infoMessage={infoMessage}
                                currentNetwork={currentNetwork}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div
                className={cn("flex-1 my-4 overflow-y-auto px-2 min-h-0", className)}
            >
                {!availableNetwork.length ? (
                    <ComingSoon />
                ) : (
                    children
                )}
            </div>
        </div>
    );
};

export default DashboardLayout;
