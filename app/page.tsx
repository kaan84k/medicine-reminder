export default function Home() {
  return (
    <main className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="p-4 p-lg-5 bg-white rounded-4 shadow-sm border">
            <p className="text-uppercase fw-semibold text-primary mb-2 small">
              Health check
            </p>
            <h1 className="display-6 fw-semibold mb-3">
              Medicine Reminder baseline is up
            </h1>
            <p className="text-secondary mb-4">
              You now have a Next.js App Router project ready for the medicine
              reminder MVP. Keep this page as a quick check that the app builds
              and serves without errors before adding features.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <span className="badge bg-success">Next.js App Router</span>
              <span className="badge bg-info text-dark">TypeScript</span>
              <span className="badge bg-secondary">Bootstrap 5 via CDN</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
