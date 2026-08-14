import { useEffect } from "react";

export function useInlineCompletion(registerProvider) {
    useEffect(() => {
        const dispose = registerProvider?.();
        return () => dispose?.dispose?.();
    }, [registerProvider]);
}
