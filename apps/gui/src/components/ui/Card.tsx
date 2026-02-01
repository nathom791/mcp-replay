import type { ReactNode } from "react"
import clsx from "clsx"

export const Card = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <section
    className={clsx(
      "panel rounded-3xl",
      className,
    )}
  >
    {children}
  </section>
)

export const CardHeader = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <header className={clsx("px-6 pt-6", className)}>{children}</header>
)

export const CardBody = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <div className={clsx("px-6 pb-6", className)}>{children}</div>
)
