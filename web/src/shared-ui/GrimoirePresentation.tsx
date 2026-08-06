import { Fragment, type CSSProperties, type ReactNode } from "react";
import "./styles/productionShell.css";

export type SeatPosition = { x: number; y: number };

export type RectangularGrimoireSeat = {
  id: string;
  position: SeatPosition;
  mobilePosition: SeatPosition;
  content: ReactNode;
  afterSeat?: ReactNode;
  className?: string;
  ariaLabel?: string;
  pressed?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
};

export function GrimoirePresentation({
  ariaLabel,
  toolbar,
  board,
  inspector,
  actions,
  className,
  workspaceClassName,
  actionsClassName,
  style,
}: {
  ariaLabel: string;
  toolbar: ReactNode;
  board: ReactNode;
  inspector?: ReactNode;
  actions?: ReactNode;
  className?: string;
  workspaceClassName?: string;
  actionsClassName?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={joinClasses("grimoirePresentation", className)} aria-label={ariaLabel}>
      {toolbar}
      <div className={joinClasses("grimoirePresentationWorkspace", workspaceClassName)} style={style}>
        {board}
        {inspector}
      </div>
      {actions === undefined ? null : <div className={joinClasses("grimoirePresentationActions", actionsClassName)}>{actions}</div>}
    </section>
  );
}

export function RectangularGrimoireBoard({
  ariaLabel,
  seats,
  center,
  className,
  centerClassName,
  style,
}: {
  ariaLabel: string;
  seats: RectangularGrimoireSeat[];
  center?: ReactNode;
  className?: string;
  centerClassName?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={joinClasses("rectangularGrimoireBoard", className)} aria-label={ariaLabel} style={style}>
      {seats.map((seat) => (
        <Fragment key={seat.id}>
          <button
            type="button"
            className={seat.className}
            aria-label={seat.ariaLabel}
            aria-pressed={seat.pressed}
            disabled={seat.disabled}
            style={{
              "--seat-x": `${seat.position.x}%`,
              "--seat-y": `${seat.position.y}%`,
              "--mobile-seat-x": `${seat.mobilePosition.x}%`,
              "--mobile-seat-y": `${seat.mobilePosition.y}%`,
            } as CSSProperties}
            onClick={seat.onSelect}
          >
            {seat.content}
          </button>
          {seat.afterSeat}
        </Fragment>
      ))}
      {center === undefined ? null : <div className={joinClasses("rectangularGrimoireCenter", centerClassName)}>{center}</div>}
    </div>
  );
}

export function grimoireHeights(playerCount: number): { desktop: number; mobile: number } {
  const desktopCounts = perimeterCounts(playerCount, false);
  const mobileCounts = perimeterCounts(playerCount, true);
  return {
    desktop: wrappedPerimeterHeight(Math.max(desktopCounts.right, desktopCounts.left), 88, 16, 12),
    mobile: wrappedPerimeterHeight(Math.max(mobileCounts.right, mobileCounts.left), 76, 12, 8),
  };
}

export function rectangularSeatPositions(playerCount: number, mobile: boolean): SeatPosition[] {
  const counts = perimeterCounts(playerCount, mobile);
  const horizontalStart = mobile ? 30 : 28;
  const horizontalEnd = mobile ? 70 : 72;
  const leftX = mobile ? 14 : 10;
  const rightX = mobile ? 86 : 90;
  const seatHeight = mobile ? 76 : 88;
  const gap = mobile ? 12 : 16;
  const padding = mobile ? 8 : 12;
  const height = mobile ? grimoireHeights(playerCount).mobile : grimoireHeights(playerCount).desktop;
  const topY = (padding + seatHeight / 2) / height * 100;
  const bottomY = (height - padding - seatHeight / 2) / height * 100;
  const maximumSideCount = Math.max(counts.right, counts.left);
  const positions: SeatPosition[] = [];

  positions.push(...distributedLine(counts.top, horizontalStart, horizontalEnd).map((x) => ({ x, y: topY })));
  positions.push(...sideSlotCenters(counts.right, maximumSideCount, seatHeight, gap, padding, height).map((y) => ({ x: rightX, y })));
  positions.push(...distributedLine(counts.bottom, horizontalEnd, horizontalStart).map((x) => ({ x, y: bottomY })));
  positions.push(...sideSlotCenters(counts.left, maximumSideCount, seatHeight, gap, padding, height).reverse().map((y) => ({ x: leftX, y })));
  return positions;
}

function perimeterCounts(playerCount: number, mobile: boolean) {
  const top = mobile ? Math.min(2, playerCount) : Math.ceil(playerCount / 4);
  const bottom = Math.min(mobile ? 2 : Math.ceil(playerCount / 4), playerCount - top);
  const vertical = playerCount - top - bottom;
  const right = Math.ceil(vertical / 2);
  return { top, right, bottom, left: vertical - right };
}

function wrappedPerimeterHeight(maximumSideCount: number, seatHeight: number, gap: number, padding: number) {
  const sideLaneHeight = maximumSideCount * seatHeight + Math.max(0, maximumSideCount - 1) * gap;
  return padding * 2 + seatHeight * 2 + gap * 2 + sideLaneHeight;
}

function sideSlotCenters(count: number, maximumCount: number, seatHeight: number, gap: number, padding: number, height: number) {
  if (count <= 0) return [];
  const maximumLaneHeight = maximumCount * seatHeight + Math.max(0, maximumCount - 1) * gap;
  const occupiedHeight = count * seatHeight + Math.max(0, count - 1) * gap;
  const laneTop = padding + seatHeight + gap + (maximumLaneHeight - occupiedHeight) / 2;
  return Array.from({ length: count }, (_, index) => (laneTop + seatHeight / 2 + index * (seatHeight + gap)) / height * 100);
}

function distributedLine(count: number, start: number, end: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(start + end) / 2];
  return Array.from({ length: count }, (_, index) => start + ((end - start) * index) / (count - 1));
}

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}
