export default function ChartCard({ icon, title, full = false, children }) {
  return (
    <div className={`dash-chart-card ${full ? 'dash-chart-full' : ''}`}>
      <div className="dash-chart-title"><span className="material-icons-outlined">{icon}</span> <span>{title}</span></div>
      <div className="dash-chart-wrap">{children}</div>
    </div>
  );
}
