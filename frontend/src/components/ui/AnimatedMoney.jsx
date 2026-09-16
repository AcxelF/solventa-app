import CountUp from "react-countup";
import { formatMoney } from "../../utils/format.js";

export default function AnimatedMoney({ value, prefix = "", className = "" }) {
  return (
    <CountUp
      end={value || 0}
      duration={0.6}
      decimals={2}
      preserveValue
      formattingFn={(n) => `${prefix}${formatMoney(n)}`}
      className={className}
    />
  );
}
