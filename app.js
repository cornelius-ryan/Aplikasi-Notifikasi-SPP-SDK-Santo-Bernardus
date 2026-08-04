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
        document.getElementById('btn-menu-siswa').style.display = 'block';
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
    
// Cari tombol yang memanggil fungsi ini, lalu beri warna biru dan muat datanya
    if (idHalaman === 'page-home') {
        document.getElementById('btn-menu-home').classList.add('menu-aktif');
    }
    if (idHalaman === 'page-tagihan') {
        document.getElementById('btn-menu-tagihan').classList.add('menu-aktif');
        muatDataTagihan('BELUM_BAYAR');
    }
    if (idHalaman === 'page-siswa') {
        document.getElementById('btn-menu-siswa').classList.add('menu-aktif');
        muatDataSiswa(); // <--- TAMBAHKAN BARIS INI
    }
}

// ==========================================
// FUNGSI MANAJEMEN DATA SISWA (BULK ADD CSV)
// ==========================================

// 1. Fungsi Membuat dan Mengunduh Format Template CSV
function downloadFormatCSV() {
    // Header wajib huruf kecil dan sesuai nama kolom di database
    const header = "nis,nama,kode_kelas,no_wa_ortu,nominal_spp\n";
    // Contoh cara pengisian untuk acuan TU
    const contoh = "2026001,Budi Santoso,5-A,6281234567890,150000\n"; 
    
    const csvContent = "data:text/csv;charset=utf-8," + header + contoh;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Format_Import_Siswa_SPP.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 2. Fungsi Membaca dan Menyimpan File CSV ke Supabase
async function uploadCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Membaca isi file teks
    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const baris = text.split("\n"); // Memisahkan data per baris (Enter)
        const dataSiswaBaru = [];

        // Mulai looping dari indeks 1 untuk melewati baris Header
        for (let i = 1; i < baris.length; i++) {
            if (baris[i].trim() === "") continue; // Lewati baris yang kosong di akhir file
            
            const kolom = baris[i].split(","); // Memisahkan data per koma
            
            if (kolom.length >= 5) {
                dataSiswaBaru.push({
                    nis: kolom[0].trim(),
                    nama: kolom[1].trim(),
                    kode_kelas: kolom[2].trim(),
                    no_wa_ortu: kolom[3].trim(),
                    nominal_spp: Number(kolom[4].trim())
                });
            }
        }

        if (dataSiswaBaru.length > 0) {
            const konfirmasi = confirm(`Terbaca ${dataSiswaBaru.length} data siswa dari file. Lanjutkan simpan ke database?`);
            if (konfirmasi) {
                // Proses Bulk Insert ke Supabase
                const { data, error } = await db.from('siswa').insert(dataSiswaBaru);
                
                if (error) {
                    // Biasa error jika ada NIS yang kembar (karena NIS kita set UNIQUE di awal)
                    alert("Gagal mengimpor data: " + error.message);
                } else {
                    alert("Berhasil mengimpor seluruh data siswa!");
                    if (error) {
                    alert("Gagal mengimpor data: " + error.message);
                } else {
                    alert("Berhasil mengimpor seluruh data siswa!");
                    muatDataSiswa(); // <--- TAMBAHKAN BARIS INI (Refresh tabel otomatis)
                }
                }
            }
        } else {
            alert("Tidak ada data yang valid untuk diimpor. Pastikan format CSV dipisahkan oleh koma.");
        }
        
        event.target.value = ''; // Reset input file agar bisa upload file yang sama lagi jika perlu
    };
    reader.readAsText(file);
}

// 3. Fungsi Menampilkan Data Siswa ke Tabel
async function muatDataSiswa() {
    // Tarik data siswa, urutkan berdasarkan kelas, lalu nama abjad
    const { data, error } = await db.from('siswa')
        .select('*')
        .order('kode_kelas', { ascending: true })
        .order('nama', { ascending: true });

    const tbody = document.getElementById('tabel-data-siswa');
    tbody.innerHTML = '';

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Gagal memuat data: ${error.message}</td></tr>`;
        return;
    }

    if (data && data.length > 0) {
        data.forEach((s, index) => {
            tbody.innerHTML += `
                <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td>${s.nis}</td>
                    <td>${s.nama}</td>
                    <td>${s.kode_kelas}</td>
                    <td>${s.no_wa_ortu}</td>
                    <td>
                        <button onclick="hapusSiswa('${s.id}')" style="background-color: #ef4444; color: white; padding: 6px 10px; font-size: 12px; margin: 0; border-radius: 4px; border: none;">Hapus</button>
                    </td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b;">Belum ada data siswa. Silakan unggah CSV.</td></tr>`;
    }
}

// 4. Fungsi Hapus Data Siswa Tunggal
async function hapusSiswa(idSiswa) {
    if (!confirm("Yakin ingin menghapus siswa ini? Seluruh riwayat tagihannya juga akan ikut terhapus!")) return;

    const { error } = await db.from('siswa').delete().eq('id', idSiswa);

    if (error) {
        alert("Gagal menghapus siswa: " + error.message);
    } else {
        muatDataSiswa(); // Refresh tabel setelah berhasil dihapus
    }
}

// ==========================================
// FUNGSI GENERATOR TAGIHAN BULANAN MASSAL
// ==========================================
async function generateTagihanMassal() {
    const inputBulan = document.getElementById('input-bulan-tagihan').value; // Format: "YYYY-MM"
    if (!inputBulan) {
        alert("Silakan pilih bulan dan tahun tagihan terlebih dahulu.");
        return;
    }

    // Ubah format menjadi tanggal standar database (misal: "2026-08-01")
    const bulanTagihanLengkap = inputBulan + "-01";

    const konfirmasi = confirm(`Anda akan membuat tagihan massal untuk periode ${bulanTagihanLengkap.toUpperCase()} bagi SELURUH siswa aktif. Lanjutkan?`);
    if (!konfirmasi) return;

    // 1. Ambil seluruh data siswa (ID dan Nominal SPP masing-masing anak)
    const { data: listSiswa, error: errorSiswa } = await db.from('siswa').select('id, nominal_spp');

    if (errorSiswa || !listSiswa || listSiswa.length === 0) {
        alert("Gagal memuat data siswa untuk digenerate: " + (errorSiswa ? errorSiswa.message : "Data siswa kosong"));
        return;
    }

    // 2. Siapkan array data tagihan baru
    const tagihanBaru = listSiswa.map(s => ({
        siswa_id: s.id,
        bulan_tagihan: bulanTagihanLengkap,
        nominal: s.nominal_spp || 150000, // Default 150rb jika nominal kosong
        status: 'BELUM_BAYAR'
    }));

    // 3. Masukkan secara massal (Bulk Insert) ke Supabase
    // Catatan: Jika di database tabel tagihan_spp sudah diberi pengaman (Unique Constraint pada siswa_id + bulan_tagihan),
    // sistem akan otomatis menolak duplikat jika bulan tersebut sudah pernah digenerate sebelumnya.
    const { data, error } = await db.from('tagihan_spp').insert(tagihanBaru);

    if (error) {
        // Jika terjadi error (misalnya duplikat karena sudah pernah dibuat)
        alert("Gagal generate tagihan: " + error.message + "\n(Kemungkinan tagihan untuk bulan ini sudah pernah dibuat sebelumnya).");
    } else {
        alert(`Berhasil! Tagihan untuk periode ${bulanTagihanLengkap} telah dibuat ke sistem.`);
        // Refresh tabel agar langsung memunculkan tagihan baru yang baru saja dibuat
        muatDataTagihan('BELUM_BAYAR');
    }
}
