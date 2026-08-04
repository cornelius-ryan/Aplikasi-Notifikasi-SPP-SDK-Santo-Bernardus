// app.js

// 1. Inisialisasi Koneksi ke Supabase
const SUPABASE_URL = 'https://xlgnbgjlxpfukyredibl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsZ25iZ2pseHBmdWt5cmVkaWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MDQ4NDMsImV4cCI6MjEwMTM4MDg0M30.-6XK60RL0kz2U2diE5V8-Niphg2X1dWk8eIKvMB3_NY';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variabel Global untuk Antrean
let daftarAntrean = [];
let indeksSaatIni = 0;

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const tombol = document.querySelector('#login-section button');
    
    tombol.innerText = 'Memproses...';
    document.getElementById('pesan-error').innerText = '';

    const { data, error } = await db.auth.signInWithPassword({ email: email, password: password });

    if (error) {
        document.getElementById('pesan-error').innerText = "Login gagal: " + error.message;
        tombol.innerText = 'Masuk';
    } else {
        tampilkanDashboard(data.user.id);
    }
}

async function tampilkanDashboard(userId) {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';

    // Tarik Profil
    const { data: profil } = await db.from('profiles').select('*').eq('id', userId).single();
    document.getElementById('nama-user').innerText = profil.nama;
    document.getElementById('role-user').innerText = profil.role.toUpperCase();

// Atur Tampilan Berdasarkan Role
    if (profil.role === 'admin') {
        // Admin: Tampilkan menu tagihan di sidebar, dan panggil data tagihan
        document.getElementById('btn-menu-tagihan').style.display = 'block';
        document.getElementById('panel-guru').style.display = 'none';
        muatDataTagihan('BELUM_BAYAR'); 
    } else {
        // Guru: Menu tagihan disembunyikan, langsung tampilkan daftar siswa di home
        document.getElementById('btn-menu-tagihan').style.display = 'none';
        document.getElementById('panel-guru').style.display = 'block';
        
        const { data: siswa } = await db.from('siswa').select('*');
        const listSiswa = document.getElementById('daftar-siswa');
        listSiswa.innerHTML = '';
        siswa.forEach(s => listSiswa.innerHTML += `<li>[${s.kode_kelas}] ${s.nama} - NIS: ${s.nis}</li>`);
    }

    // Pastikan saat pertama kali login, yang terbuka selalu Dashboard Utama (Home)
    bukaMenu('page-home');
}

// Fungsi untuk memuat tabel berdasarkan status (LUNAS / BELUM_BAYAR)
async function muatDataTagihan(statusTarget = 'BELUM_BAYAR') {
    const { data, error } = await db.from('tagihan_spp')
        .select(`id, bulan_tagihan, nominal, status, siswa ( nama, kode_kelas, no_wa_ortu )`)
        .eq('status', statusTarget)
        .order('bulan_tagihan', { ascending: false }); // Urutkan dari bulan terbaru

    const tbody = document.getElementById('tabel-tunggakan');
    tbody.innerHTML = '';
    
    // Matikan centang master jika sedang melihat data Lunas (karena tidak perlu di-WA)
    document.getElementById('check-all').disabled = (statusTarget === 'LUNAS');
    
    if(data) {
        data.forEach(row => {
            let tombolAksi = '';
            let kotakCentang = '';
            let warnaStatus = statusTarget === 'LUNAS' ? '#4CAF50' : '#ff9800';

            // Tentukan tombol apa yang muncul berdasarkan status saat ini
            if (statusTarget === 'BELUM_BAYAR') {
                tombolAksi = `<button onclick="ubahStatusTagihan('${row.id}', 'LUNAS')" style="background-color: #4CAF50; color: white; padding: 6px 12px; font-size: 12px; margin: 0;">Tandai Lunas</button>`;
                kotakCentang = `<input type="checkbox" class="chk-item" data-nama="${row.siswa.nama}" data-wa="${row.siswa.no_wa_ortu}" data-nominal="${row.nominal}" data-bulan="${row.bulan_tagihan}">`;
            } else {
                tombolAksi = `<button onclick="ubahStatusTagihan('${row.id}', 'BELUM_BAYAR')" style="background-color: #f44336; color: white; padding: 6px 12px; font-size: 12px; margin: 0;">Batal Lunas</button>`;
                kotakCentang = `<input type="checkbox" disabled>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td style="text-align: center;">${kotakCentang}</td>
                    <td>${row.siswa.nama}</td>
                    <td>${row.siswa.kode_kelas}</td>
                    <td>${row.bulan_tagihan}</td>
                    <td>Rp${row.nominal.toLocaleString('id-ID')}</td>
                    <td><span style="background-color: ${warnaStatus}; color: white; padding: 3px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">${statusTarget}</span></td>
                    <td>${tombolAksi}</td>
                </tr>
            `;
        });
    }
}

// Fungsi untuk mengeksekusi perubahan status ke Database Supabase
async function ubahStatusTagihan(idTagihan, statusBaru) {
    // Memunculkan kotak konfirmasi (Mencegah admin salah klik)
    let pesanKonfirmasi = statusBaru === 'LUNAS' 
        ? 'Apakah Anda yakin tagihan ini SUDAH DIBAYAR?' 
        : 'AWAS! Batalkan status lunas dan kembalikan ke MENUNGGAK?';
        
    if (!confirm(pesanKonfirmasi)) return; // Jika admin klik 'Cancel', batalkan proses

    // Jika lunas, catat tanggal hari ini. Jika batal, kembalikan ke kosong (null)
    const tanggalBayar = statusBaru === 'LUNAS' ? new Date().toISOString() : null;

    // Kirim perintah UPDATE ke Supabase
    const { error } = await db.from('tagihan_spp')
        .update({ status: statusBaru, tanggal_bayar: tanggalBayar })
        .eq('id', idTagihan);

    if (error) {
        alert("Gagal memperbarui data: " + error.message);
    } else {
        // Jika berhasil, muat ulang tabel di halaman yang sama agar data ter-refresh
        const statusSedangDilihat = statusBaru === 'LUNAS' ? 'BELUM_BAYAR' : 'LUNAS';
        muatDataTagihan(statusSedangDilihat);
    }
}

function centangSemua() {
    const master = document.getElementById('check-all').checked;
    document.querySelectorAll('.chk-item').forEach(chk => chk.checked = master);
}

function siapkanAntrean() {
    daftarAntrean = []; 
    indeksSaatIni = 0;
    
    const mapAntrean = new Map();

    document.querySelectorAll('.chk-item:checked').forEach(chk => {
        const nama = chk.dataset.nama;
        const wa = chk.dataset.wa;
        const nominal = Number(chk.dataset.nominal); 
        const bulan = chk.dataset.bulan;

        if (mapAntrean.has(wa)) {
            const dataSiswa = mapAntrean.get(wa);
            dataSiswa.nominal += nominal;
            dataSiswa.bulan.push(bulan);
        } else {
            mapAntrean.set(wa, { nama: nama, wa: wa, nominal: nominal, bulan: [bulan] });
        }
    });

    daftarAntrean = Array.from(mapAntrean.values());

    if (daftarAntrean.length === 0) {
        alert("Silakan centang minimal satu siswa terlebih dahulu.");
        return;
    }

    document.getElementById('antrean-panel').style.display = 'block';
    updateLayarAntrean();
}

function updateLayarAntrean() {
    const statusText = document.getElementById('status-antrean');
    const btnKirim = document.getElementById('btn-kirim-wa');

    if (indeksSaatIni < daftarAntrean.length) {
        const target = daftarAntrean[indeksSaatIni];
        statusText.innerHTML = `Mengirim pesan <b>${indeksSaatIni + 1} dari ${daftarAntrean.length}</b><br>Tujuan: <b>${target.nama}</b> (${target.wa})`;
        btnKirim.innerText = `Kirim Pesan ke-${indeksSaatIni + 1}`;
        btnKirim.style.display = 'inline-block';
    } else {
        statusText.innerHTML = `<span style="color: green; font-weight: bold;">Selesai!</span> Semua pesan dalam antrean sudah diproses.`;
        btnKirim.style.display = 'none';
    }
}

function kirimWaSekarang() {
    const target = daftarAntrean[indeksSaatIni];
    const daftarBulan = target.bulan.join(' dan ');
    
    const teksPesan = `Halo Bapak/Ibu Wali Murid dari *${target.nama}*,\n\nIni adalah pengingat dari sekolah bahwa terdapat tagihan SPP bulan *${daftarBulan}* dengan total sebesar *Rp${target.nominal.toLocaleString('id-ID')}* yang belum diselesaikan.\n\nMohon untuk segera melakukan pembayaran. Terima kasih.`;
    const linkWa = `https://wa.me/${target.wa}?text=${encodeURIComponent(teksPesan)}`;
    
    window.open(linkWa, '_blank');
    indeksSaatIni++;
    updateLayarAntrean();
}

function batalAntrean() {
    document.getElementById('antrean-panel').style.display = 'none';
    daftarAntrean = [];
}

async function logout() {
    await db.auth.signOut();
    window.location.reload();
}

// Fungsi untuk memindahkan tab menu halaman
function bukaMenu(idHalaman) {
    // 1. Sembunyikan semua halaman
    document.querySelectorAll('.halaman').forEach(hal => hal.classList.remove('aktif'));
    // 2. Munculkan halaman yang dipilih
    document.getElementById(idHalaman).classList.add('aktif');

    // 3. Ubah warna tombol menu di sidebar agar terlihat sedang aktif
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('menu-aktif'));
    
    // Cari tombol yang memanggil fungsi ini, lalu beri warna biru
    if (idHalaman === 'page-home') document.getElementById('btn-menu-home').classList.add('menu-aktif');
    if (idHalaman === 'page-tagihan') document.getElementById('btn-menu-tagihan').classList.add('menu-aktif');
}
