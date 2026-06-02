import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4 text-blue-600">Phin Đi - V2</h1>
        <p className="text-gray-600 mb-8">Hệ thống đang được chuyển đổi sang Next.js và Google Sheets.</p>
        <Link href="/login" className="inline-block bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors">
          Đi đến Đăng nhập
        </Link>
      </div>
    </main>
  );
}
