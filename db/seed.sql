-- ============================================================
-- TGC Rongai Campus Tracker — Seed data
-- Edit this file to change what ships with a fresh install,
-- then rebuild data/tracker.db (see db/build_db.py / README).
-- ============================================================

INSERT INTO members (id, name) VALUES
  ('mem_grace',  'Grace Wanjiru'),
  ('mem_kevin',  'Kevin Otieno'),
  ('mem_faith',  'Faith Njeri'),
  ('mem_brian',  'Brian Mutiso'),
  ('mem_mercy',  'Mercy Achieng');

INSERT INTO hotspots (id, name, leader_id, capacity) VALUES
  ('hot_zawadi', 'Hotspot Zawadi', 'mem_grace', 10),
  ('hot_amani',  'Hotspot Amani',  'mem_kevin', 10),
  ('hot_neema',  'Hotspot Neema',  'mem_faith', 10),
  ('hot_baraka', 'Hotspot Baraka', 'mem_brian', 10),
  ('hot_imani',  'Hotspot Imani',  'mem_mercy', 10);

INSERT INTO soul_records (id, name, won_by_id, date_of_outreach, mobile, status, context, follow_up_id, hotspot_id, plug_in_stage) VALUES
  ('soul_peter', 'Peter Kamau', 'mem_kevin', '2026-06-14', '0712 345 678', 'New Soul', 'Stays in Kware, works as a boda rider, met at the market outreach.', 'mem_grace', 'hot_zawadi', 'Guest'),
  ('soul_linet', 'Linet Wambui', 'mem_brian', '2026-05-02', '0722 111 222', 'Rededicated Their Life', 'University student at TUK, rededicated her life during campus outreach.', 'mem_faith', 'hot_amani', 'Attends Hotspot'),
  ('soul_samuel', 'Samuel Ouma', 'mem_mercy', '2026-04-20', '0733 909 090', 'New Soul', 'Met through a friend''s invite, works at a barber shop in Rongai.', 'mem_mercy', 'hot_zawadi', 'Attends Get Set'),
  ('soul_james', 'James Mwaura', 'mem_grace', '2026-07-18', '0710 223 344', 'New Soul', 'Met at the bus stop outreach, works at a hardware shop in Rongai town.', 'mem_grace', 'hot_zawadi', 'Guest'),
  ('soul_sarah', 'Sarah Chepkemoi', 'mem_kevin', '2026-07-10', '0721 556 677', 'Already Born Again', 'Moved to Rongai recently from Eldoret, looking for a church home.', 'mem_kevin', 'hot_amani', 'Attends Hotspot'),
  ('soul_michael', 'Michael Kariuki', 'mem_faith', '2026-06-25', '0733 889 900', 'New Soul', 'Works as a mechanic near Tuala, met through a workmate''s invite.', 'mem_faith', 'hot_neema', 'Attends Get Set'),
  ('soul_alice', 'Alice Nyokabi', 'mem_brian', '2026-06-10', '0745 112 233', 'Rededicated Their Life', 'University student, rededicated during a hostel Bible study outreach.', 'mem_brian', 'hot_baraka', 'Attends Hotspot'),
  ('soul_tom', 'Tom Odongo', 'mem_mercy', '2026-05-28', '0700 998 877', 'New Soul', 'Boda rider met at the stage outreach near Kware.', 'mem_mercy', 'hot_imani', 'Guest'),
  ('soul_lucy', 'Lucy Wanjala', 'mem_grace', '2026-05-15', '0711 334 455', 'New Soul', 'Works at a salon in Rongai, very warm and welcoming personality.', 'mem_grace', 'hot_zawadi', 'Attends Hotspot'),
  ('soul_briank', 'Brian Kiptanui', 'mem_kevin', '2026-04-30', '0722 665 544', 'Already Born Again', 'New to Rongai, previously fellowshipped at a church upcountry.', 'mem_kevin', 'hot_amani', 'Attends Get Set'),
  ('soul_nancy', 'Nancy Cherotich', 'mem_faith', '2026-04-15', '0733 221 100', 'New Soul', 'Met at the market outreach, sells vegetables near Nkoroi.', 'mem_faith', 'hot_neema', 'Guest'),
  ('soul_paul', 'Paul Mbugua', 'mem_brian', '2026-03-22', '0710 887 766', 'Rededicated Their Life', 'Long-time Rongai resident, rededicated after a men''s outreach breakfast.', 'mem_brian', 'hot_baraka', 'Attends Hotspot'),
  ('soul_faithn', 'Faith Nekesa', 'mem_mercy', '2026-02-10', '0721 998 811', 'New Soul', 'Met through a friend''s invite at a women''s outreach event.', 'mem_mercy', 'hot_imani', 'Attends Get Set');

INSERT INTO soul_church_attendance (soul_id, date) VALUES
  ('soul_peter', '2026-06-15'),
  ('soul_linet', '2026-05-04'),
  ('soul_linet', '2026-05-11'),
  ('soul_samuel', '2026-04-27'),
  ('soul_james', '2026-07-20'),
  ('soul_sarah', '2026-07-13'),
  ('soul_alice', '2026-06-14'),
  ('soul_lucy', '2026-05-18'),
  ('soul_briank', '2026-05-04'),
  ('soul_paul', '2026-04-05'),
  ('soul_faithn', '2026-02-15');

INSERT INTO soul_hotspot_attendance (soul_id, date) VALUES
  ('soul_linet', '2026-05-10'),
  ('soul_linet', '2026-05-17'),
  ('soul_linet', '2026-06-01'),
  ('soul_samuel', '2026-04-26'),
  ('soul_samuel', '2026-05-03'),
  ('soul_sarah', '2026-07-12'),
  ('soul_michael', '2026-06-28'),
  ('soul_michael', '2026-07-05'),
  ('soul_alice', '2026-06-20'),
  ('soul_lucy', '2026-05-20'),
  ('soul_lucy', '2026-06-01'),
  ('soul_briank', '2026-05-02'),
  ('soul_paul', '2026-04-01'),
  ('soul_paul', '2026-05-01'),
  ('soul_paul', '2026-06-01');

INSERT INTO soul_notes (soul_id, when_ts, text) VALUES
  ('soul_peter', '2026-07-22T09:00:00.000Z', 'Called him, he sounded excited about church. Invited him for hotspot this week.'),
  ('soul_linet', '2026-06-02T09:00:00.000Z', 'Missed last two church services, exams. Will check in after exams end.'),
  ('soul_james', '2026-07-22T10:00:00.000Z', 'Quick call, doing well, promised to attend hotspot this week.'),
  ('soul_sarah', '2026-07-15T09:00:00.000Z', 'Settling in well, connected her with two ladies in the hotspot.'),
  ('soul_alice', '2026-07-20T09:00:00.000Z', 'Doing well, exams are over, back to regular hotspot attendance.'),
  ('soul_tom', '2026-06-01T09:00:00.000Z', 'Hard to reach, phone off most times. Will try visiting in person.'),
  ('soul_lucy', '2026-07-23T08:00:00.000Z', 'Caught up after service today, she''s doing really well.'),
  ('soul_briank', '2026-05-05T09:00:00.000Z', 'Attended Get Set once, hasn''t been reachable since.'),
  ('soul_paul', '2026-07-21T09:00:00.000Z', 'Very consistent, growing fast, considering him for Get Set next.'),
  ('soul_faithn', '2026-03-01T09:00:00.000Z', 'Been quiet for a while, need to schedule a home visit.');

INSERT INTO church_members (id, name, address, mobile, hotspot_id, is_hotspot_leader, leader_or_discipler, notes) VALUES
  ('cm_grace', 'Grace Wanjiru', 'Kware, Rongai', '0700 456 789', 'hot_zawadi', 1, 'Pastor Benjamin', 'Serving in the media department. Leads Hotspot Zawadi faithfully.'),
  ('cm_esther_nyambura', 'Esther Nyambura', 'Kandisi Farm, Rongai', '0714 504 766', 'hot_zawadi', 0, 'Grace Wanjiru', 'Solid in the faith, a great encouragement to the hotspot family.'),
  ('cm_dennis_kiptoo', 'Dennis Kiptoo', 'Tuala, Rongai', '0712 940 648', 'hot_zawadi', 0, 'Grace Wanjiru', 'Faithful in attendance, growing steadily in the Word.'),
  ('cm_caroline_atieno', 'Caroline Atieno', 'Maasai Lodge Road, Rongai', '0721 696 159', 'hot_zawadi', 0, 'Grace Wanjiru', 'Recently joined the choir, doing well in hotspot fellowship.'),
  ('cm_joseph_mwangi', 'Joseph Mwangi', 'Rongai Bypass, Rongai', '0711 188 544', 'hot_zawadi', 0, 'Grace Wanjiru', 'Consistent server, reliable and encouraging to others.'),
  ('cm_ruth_chebet', 'Ruth Chebet', 'Silole, Rongai', '0712 346 192', 'hot_zawadi', 0, 'Grace Wanjiru', 'Balancing work and church well, still very committed.'),
  ('cm_kevin', 'Kevin Otieno', 'Nkoroi, Rongai', '0711 222 333', 'hot_amani', 1, 'Pastor Benjamin', 'Serving in the ushering department. Leads Hotspot Amani with consistency.'),
  ('cm_daniel_kimani', 'Daniel Kimani', 'Ongata Rongai Town', '0711 946 679', 'hot_amani', 0, 'Kevin Otieno', 'Balancing work and church well, still very committed.'),
  ('cm_sharon_adhiambo', 'Sharon Adhiambo', 'Enkasiti, Rongai', '0717 745 742', 'hot_amani', 0, 'Kevin Otieno', 'Recently joined the choir, doing well in hotspot fellowship.'),
  ('cm_victor_omondi', 'Victor Omondi', 'Bogani, Rongai', '0728 699 506', 'hot_amani', 0, 'Kevin Otieno', 'Faithful in attendance, growing steadily in the Word.'),
  ('cm_ann_wangari', 'Ann Wangari', 'Kware Phase 2, Rongai', '0717 147 670', 'hot_amani', 0, 'Kevin Otieno', 'Faithful in attendance, growing steadily in the Word.'),
  ('cm_moses_korir', 'Moses Korir', 'Kimuka Road, Rongai', '0719 529 247', 'hot_amani', 0, 'Kevin Otieno', 'Active in hotspot, currently mentoring a new soul.'),
  ('cm_faith', 'Faith Njeri', 'Kandisi, Rongai', '0722 444 555', 'hot_neema', 1, 'Pastor Benjamin', 'Serving in the worship team. Leads Hotspot Neema with a strong prayer life.'),
  ('cm_beatrice_wafula', 'Beatrice Wafula', 'Olerai, Rongai', '0728 415 673', 'hot_neema', 0, 'Faith Njeri', 'Recently joined the choir, doing well in hotspot fellowship.'),
  ('cm_collins_ochieng', 'Collins Ochieng', 'Nkoroi Shopping Centre, Rongai', '0713 695 684', 'hot_neema', 0, 'Faith Njeri', 'Active in hotspot, currently mentoring a new soul.'),
  ('cm_purity_njoroge', 'Purity Njoroge', 'Rimpa Estate, Rongai', '0721 199 660', 'hot_neema', 0, 'Faith Njeri', 'Consistent server, reliable and encouraging to others.'),
  ('cm_elias_sang', 'Elias Sang', 'Kware Baptist, Rongai', '0728 161 733', 'hot_neema', 0, 'Faith Njeri', 'Recently joined the choir, doing well in hotspot fellowship.'),
  ('cm_winnie_auma', 'Winnie Auma', 'Nkoroi Phase 3, Rongai', '0725 796 644', 'hot_neema', 0, 'Faith Njeri', 'Consistent server, reliable and encouraging to others.'),
  ('cm_brian', 'Brian Mutiso', 'Simba Estate, Rongai', '0733 666 777', 'hot_baraka', 1, 'Pastor Benjamin', 'Serving in the media department. Leads Hotspot Baraka, growing in leadership.'),
  ('cm_patrick_njuguna', 'Patrick Njuguna', 'Kandisi Ridge, Rongai', '0734 421 576', 'hot_baraka', 0, 'Brian Mutiso', 'Balancing work and church well, still very committed.'),
  ('cm_lilian_moraa', 'Lilian Moraa', 'Nkoroi, Rongai', '0721 406 354', 'hot_baraka', 0, 'Brian Mutiso', 'New to serving but showing great enthusiasm.'),
  ('cm_stephen_otieno', 'Stephen Otieno', 'Katarina, Rongai', '0732 898 349', 'hot_baraka', 0, 'Brian Mutiso', 'Active in hotspot, currently mentoring a new soul.'),
  ('cm_agnes_wambua', 'Agnes Wambua', 'Kware Junior, Rongai', '0728 407 637', 'hot_baraka', 0, 'Brian Mutiso', 'Recently joined the choir, doing well in hotspot fellowship.'),
  ('cm_david_kiplagat', 'David Kiplagat', 'Kandisi, Rongai', '0738 451 846', 'hot_baraka', 0, 'Brian Mutiso', 'New to serving but showing great enthusiasm.'),
  ('cm_mercy', 'Mercy Achieng', 'Rimpa, Rongai', '0744 888 999', 'hot_imani', 1, 'Pastor Benjamin', 'Serving in the children''s department. Leads Hotspot Imani, very relational.'),
  ('cm_nancy_wairimu', 'Nancy Wairimu', 'Rongai Town Centre', '0719 723 174', 'hot_imani', 0, 'Mercy Achieng', 'New to serving but showing great enthusiasm.'),
  ('cm_felix_odhiambo', 'Felix Odhiambo', 'Enkasiti Farm, Rongai', '0726 528 268', 'hot_imani', 0, 'Mercy Achieng', 'Recently joined the choir, doing well in hotspot fellowship.'),
  ('cm_grace_cherono', 'Grace Cherono', 'Rimpa, Rongai', '0714 600 531', 'hot_imani', 0, 'Mercy Achieng', 'Solid in the faith, a great encouragement to the hotspot family.'),
  ('cm_isaac_mutua', 'Isaac Mutua', 'Kware Primary, Rongai', '0731 179 882', 'hot_imani', 0, 'Mercy Achieng', 'Faithful in attendance, growing steadily in the Word.'),
  ('cm_diana_nafula', 'Diana Nafula', 'Kiserian Road, Rongai', '0720 811 458', 'hot_imani', 0, 'Mercy Achieng', 'Solid in the faith, a great encouragement to the hotspot family.');

INSERT INTO church_member_disciples (church_member_id, disciple_id) VALUES
  ('cm_grace', 'cm_esther_nyambura'),
  ('cm_grace', 'cm_dennis_kiptoo'),
  ('cm_grace', 'cm_caroline_atieno'),
  ('cm_grace', 'cm_joseph_mwangi'),
  ('cm_grace', 'cm_ruth_chebet'),
  ('cm_kevin', 'cm_daniel_kimani'),
  ('cm_kevin', 'cm_sharon_adhiambo'),
  ('cm_kevin', 'cm_victor_omondi'),
  ('cm_kevin', 'cm_ann_wangari'),
  ('cm_kevin', 'cm_moses_korir'),
  ('cm_faith', 'cm_beatrice_wafula'),
  ('cm_faith', 'cm_collins_ochieng'),
  ('cm_faith', 'cm_purity_njoroge'),
  ('cm_faith', 'cm_elias_sang'),
  ('cm_faith', 'cm_winnie_auma'),
  ('cm_brian', 'cm_patrick_njuguna'),
  ('cm_brian', 'cm_lilian_moraa'),
  ('cm_brian', 'cm_stephen_otieno'),
  ('cm_brian', 'cm_agnes_wambua'),
  ('cm_brian', 'cm_david_kiplagat'),
  ('cm_mercy', 'cm_nancy_wairimu'),
  ('cm_mercy', 'cm_felix_odhiambo'),
  ('cm_mercy', 'cm_grace_cherono'),
  ('cm_mercy', 'cm_isaac_mutua'),
  ('cm_mercy', 'cm_diana_nafula');

INSERT INTO settings (key, value) VALUES
  ('noteWarnDays',   '3'),
  ('noteDangerDays', '7'),
  ('weeklyHotspotTarget', '10'),
  ('previousSoulsWon', '0');
